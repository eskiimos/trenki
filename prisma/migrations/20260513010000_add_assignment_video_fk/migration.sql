-- Add foreign key from training_assignments.videoId to videos.id
ALTER TABLE "training_assignments"
  ADD CONSTRAINT "training_assignments_videoId_fkey"
  FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
