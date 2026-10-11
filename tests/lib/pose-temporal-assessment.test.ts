import { describe, expect, it } from 'vitest';
import { createTemporalState, evaluateTemporalAssessment, createTempoAccumulator, accumulateTempo, summarizeTempo } from '@/lib/pose/temporal-assessment';
import { assessmentAngles, evaluatePoseAssessment, type PreparedAssessmentReference } from '@/lib/pose/assessment';
import { ASSESSMENT_ANGLES, assessmentPreset } from '@/lib/pose/assessment-settings';
import { encodeFrame, LM } from '@/lib/pose/reference';

const angleAt = (ms: number) => 90 + 55 * Math.sin(ms / 350);
function camera(angle: number) {
  const points = Array.from({length:33}, () => ({x:0.5,y:0.5,z:0,visibility:0.95}));
  const world = Array.from({length:33}, () => ({x:0,y:0,z:0}));
  world[LM.lShoulder] = {x:0,y:0,z:0}; world[LM.lElbow] = {x:0,y:1,z:0};
  world[LM.rShoulder]={x:-0.4,y:0,z:0};world[LM.rElbow]={x:-0.4,y:1,z:0};world[LM.rWrist]={x:0.6,y:1,z:0};
  world[LM.lHip]={x:0.1,y:1.5,z:0};world[LM.rHip]={x:-0.1,y:1.5,z:0};
  world[LM.lKnee]={x:0.1,y:2.5,z:0};world[LM.rKnee]={x:-0.1,y:2.5,z:0};
  world[LM.lAnkle]={x:0.1,y:3.5,z:0};world[LM.rAnkle]={x:-0.1,y:3.5,z:0};
  world[LM.lWrist] = {x:Math.sin(angle * Math.PI / 180),y:1-Math.cos(angle * Math.PI / 180),z:0};
  return encodeFrame(0, points, world);
}
function reference(still = false): PreparedAssessmentReference {
  const rule = assessmentPreset('core'); rule.profile='custom'; rule.weights.trunk=0;rule.weights.elbowL=3;rule.requiredAngles=['elbowL'];
  const frames = Array.from({length:200}, (_,i) => ({timeMs:i*50,hasPose:true,angles:{...Object.fromEntries(ASSESSMENT_ANGLES.map(k=>[k,null])),elbowL:still?90:angleAt(i*50)} as PreparedAssessmentReference['frames'][number]['angles']}));
  return {durationMs:10000,segments:[{startMs:0,endMs:10000,assessment:rule}],frames,times:frames.map(f=>[f.timeMs])};
}
function run(ref = reference(), lag = 700, automatic = true, stillCamera = false) {
  const state = createTemporalState();
  let result;
  for(let t=2000;t<=4400;t+=100) result=evaluateTemporalAssessment(state,ref,camera(stillCamera?90:angleAt(t-lag)),t,t,500,'same',automatic);
  return {state,result:result!};
}
describe('bounded temporal comparison', () => {
  it('estimates one window lag, improves similar delayed motion and scores synchrony separately', () => {
    const ref=reference();const {result}=run(ref);
    expect(result.adjustmentMs).toBe(200); expect(result.delayMs).toBe(700);
    const follow=evaluateTemporalAssessment(run(ref).state,ref,camera(angleAt(4600-700)),4600,4600,500,'same');
    const raw=evaluatePoseAssessment(ref,camera(angleAt(4600-700)),4100,'same');
    expect(follow.result.score!).toBeGreaterThan(raw.score!);expect(follow.result.score).toBe(100);
    expect(result.tempoScore).toBe(44);
  });
  it('keeps reaction time and tempo in real milliseconds when playback is faster or slower', () => {
    for(const rate of [0.5,2]){
      const ref=reference();const state=createTemporalState();let result;
      for(let t=2000;t<=4400;t+=100)result=evaluateTemporalAssessment(state,ref,camera(angleAt((t-700)*rate)),t*rate,t,500,'same',true,rate);
      expect(Math.abs(result!.adjustmentMs-200)).toBeLessThanOrEqual(50);expect(result!.delayMs).toBe((500+result!.adjustmentMs)*rate);
      expect(result!.tempoScore).toBe(Math.round(100*(1-Math.max(0,Math.abs(result!.adjustmentMs)-75)/225)));
    }
  });
  it('estimates timing with adjustment disabled but preserves the fixed comparison', () => {
    const {result}=run(reference(),700,false);expect(result.adjustmentMs).toBe(0);expect(result.delayMs).toBe(500);expect(result.tempoScore).toBe(44);
  });
  it('does not award tempo for stationary people or stationary reference poses', () => {
    expect(run(reference(),700,true,true).result.tempoScore).toBeNull();
    expect(run(reference(true)).result.tempoScore).toBeNull();
  });
  it('requires enough consecutive observations, clears on missing camera and cannot rescue a missing pose', () => {
    const ref=reference();const {state}=run(ref);
    const missing=evaluateTemporalAssessment(state,ref,[0],4500,4500,500,'same');
    expect(missing.result.status).toBe('no_camera_pose');expect(missing.result.score).toBeNull();expect(state.observations).toHaveLength(0);
    expect(evaluateTemporalAssessment(state,ref,camera(angleAt(4000)),4500,4600,500,'same').tempoScore).toBeNull();
  });
  it('resets after gaps, seeks, side changes and configured delay changes', () => {
    for(const [media,captured,base,side] of [[4600,5600,500,'same'],[8000,4500,500,'same'],[4500,4500,800,'same'],[4500,4500,500,'opposite']] as const){
      const {state}=run();const r=evaluateTemporalAssessment(state,reference(),camera(angleAt(3800)),media,captured,base,side);
      expect(r.tempoScore).toBeNull();expect(r.adjustmentMs).toBe(0);
    }
  });
  it('does not claim confident synchrony when the best match reaches the search limit', () => {
    const {result}=run(reference(),900);expect(result.tempoScore).toBeNull();expect(result.adjustmentMs).toBe(0);
  });
  it('does not use future teacher frames or search beyond the 300ms allowance', () => {
    const ref=reference();const {result}=run(ref,950);
    expect(Math.abs(result.adjustmentMs)).toBeLessThanOrEqual(300);
    const state=createTemporalState();let r;
    for(let t=1000;t<3500;t+=100)r=evaluateTemporalAssessment(state,ref,camera(angleAt(t)),t,t,0,'same');
    expect(r!.delayMs).toBeGreaterThanOrEqual(0);expect(r!.result.referenceTimeMs!).toBeLessThanOrEqual(3400);
  });
  it('never borrows frames or alignment history across adjoining work segments', () => {
    const ref=reference();const rule=ref.segments[0]!.assessment!;
    ref.segments=[{startMs:0,endMs:4000,assessment:rule},{startMs:4000,endMs:10000,assessment:{...rule,toleranceDeg:10}}];
    const {state}=run(ref);const r=evaluateTemporalAssessment(state,ref,camera(angleAt(3900)),4500,4500,500,'same');
    expect(state.observations).toHaveLength(1);expect(r.adjustmentMs).toBe(0);expect(r.result.referenceTimeMs!).toBeGreaterThanOrEqual(4000);
  });
  it('keeps rest and gaps unavailable instead of finding a matching neighbouring pose', () => {
    const ref=reference();ref.segments=[{startMs:0,endMs:3000,assessment:ref.segments[0]!.assessment}];
    const {result}=run(ref);expect(result.result.status).toBe('inactive');expect(result.tempoScore).toBeNull();
  });
  it('does not improve similarity by dropping difficult optional joints in the shifted reference', () => {
    const ref=reference();const settings=ref.segments[0]!.assessment!;
    for(const key of ['elbowR','kneeL','kneeR','hipL'] as const)settings.weights[key]=1;
    const still=assessmentAngles(camera(90));
    ref.frames=ref.frames.map(f=>({...f,angles:{...still,elbowL:f.angles.elbowL,elbowR:120}}));
    const {state,result}=run(ref);expect(result.adjustmentMs).toBe(200);
    ref.frames[75]!.angles.elbowR=null;
    const next=evaluateTemporalAssessment(state,ref,camera(angleAt(3750)),4450,4450,500,'same');
    expect(next.adjustmentMs).toBe(0);expect(next.tempoScore).toBeNull();expect(next.result.referenceTimeMs).toBe(3950);
  });
  it('requires three seconds of identified motion for a final tempo percentage', () => {
    const acc=createTempoAccumulator();accumulateTempo(acc,null,500);expect(summarizeTempo(acc)).toBeNull();
    for(let i=0;i<5;i++)accumulateTempo(acc,44,500);expect(summarizeTempo(acc)).toBeNull();
    accumulateTempo(acc,44,500);expect(summarizeTempo(acc)).toBe(44);
    accumulateTempo(acc,100,10000);expect(acc.scoredMs).toBe(3500);
  });
});
