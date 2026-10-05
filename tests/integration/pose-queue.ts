// Execute the bundle in the worker image on an isolated Docker network only.
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { prisma } from '../../src/lib/prisma';
import { getObjectBuffer } from '../../src/lib/s3';
import { enqueuePoseJob, cancelPoseJob, enqueueMissingPoseJobs } from '../../src/lib/pose/jobs';
import { claimPoseJob, commitPoseResult, processPoseJob } from '../../workers/pose-worker';
import { validateReferenceDoc, type PoseReferenceDoc } from '../../src/lib/pose/reference';

async function main() {
  assert(process.env.POSE_WORKER_TEST === '1');
  assert(process.env.DATABASE_URL?.includes('@trenki-pose-queue-test-db:5432/pose_test'));
  assert.equal(process.env.S3_BUCKET, 'pose-test');
  assert.equal(process.env.S3_ENDPOINT, 'http://trenki-pose-queue-test-s3:9000');
  const trainer = await prisma.trainer.create({ data: { name: 'Pose', lastName: 'Test', speciality: 'Test', experience: 1 } });
  const video = await prisma.video.create({ data: { title: 'Real four-second smoke test', duration: 4,
    videoUrl: 's3://videos/sample.mp4', trainerId: trainer.id, category: 'GENERAL', difficulty: 'BEGINNER',
    isPublished: true, tags: [], equipment: [], trainingGoals: [], ageGroups: [], sports: [] } });
  const concurrent = await Promise.all(Array.from({ length: 4 }, () => enqueuePoseJob(video.id)));
  assert.equal(concurrent.filter((r) => r === 'queued').length, 1);
  assert.equal(await prisma.poseReferenceJob.count({ where: { videoId: video.id } }), 1);
  const claims = await Promise.all([claimPoseJob(), claimPoseJob()]);
  assert.equal(claims.filter(Boolean).length, 1);
  const job = claims.find(Boolean)!;
  await processPoseJob(job);
  const finished = await prisma.poseReferenceJob.findUniqueOrThrow({ where: { id: job.id } });
  assert.equal(finished.status, 'DONE', finished.error ?? '');
  const reference = await prisma.poseReference.findUniqueOrThrow({ where: { videoId: video.id } });
  const bytes = await getObjectBuffer(reference.framesUrl.slice(5));
  const doc: PoseReferenceDoc = JSON.parse(gunzipSync(bytes).toString());
  assert.equal(validateReferenceDoc(doc), null);
  assert.equal(doc.frames.length, 40);
  assert(reference.detectedRatio > 0.5);
  const after = await prisma.video.findUniqueOrThrow({ where: { id: video.id } });
  assert.equal(after.videoUrl, video.videoUrl); assert.equal(after.isPublished, true);
  assert.equal(await enqueuePoseJob(video.id), 'ready');
  assert.equal((await enqueueMissingPoseJobs()).queued, 0);

  // A stale attempt is reclaimed without burning another genuine-error attempt.
  await enqueuePoseJob(video.id, true);
  const stale = (await claimPoseJob())!;
  await prisma.poseReferenceJob.update({ where: { id: stale.id }, data: { heartbeatAt: new Date(0) } });
  const resumed = (await claimPoseJob())!;
  assert.notEqual(resumed.runToken, stale.runToken);
  assert.equal(resumed.attempts, stale.attempts);
  assert.equal(resumed.interruptions, stale.interruptions + 1);
  assert.equal(await commitPoseResult(stale, 's3://pose/wrong.json.gz', doc), false);
  await cancelPoseJob(video.id);
  assert.equal(await commitPoseResult(resumed, 's3://pose/wrong.json.gz', doc), false);
  assert.equal((await prisma.poseReference.findUniqueOrThrow({ where: { videoId: video.id } })).framesUrl, reference.framesUrl);

  // Editing segments while a rerun is underway rejects its old snapshot.
  await enqueuePoseJob(video.id, true);
  const edited = (await claimPoseJob())!;
  await prisma.poseReference.update({ where: { videoId: video.id }, data: { segments: [{ startMs: 500, endMs: 2000 }] } });
  assert.equal(await commitPoseResult(edited, 's3://pose/wrong.json.gz', doc), false);
  assert.equal((await prisma.poseReferenceJob.findUniqueOrThrow({ where: { id: edited.id } })).status, 'CANCELED');
  console.log(JSON.stringify({ status: 'passed', frames: doc.frames.length, detectedRatio: reference.detectedRatio,
    checks: ['concurrent enqueue', 'exclusive claim', 'real CPU inference', 'S3 gzip readback', 'atomic publication', 'skip ready', 'stale reclaim', 'fenced old attempt', 'cancellation', 'edited segments protected'] }));
}
void main().catch((error) => { console.error(error.name, error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
