import { describe, expect, it } from 'vitest';
import { createFeedbackState, updateLiveFeedback, highlightPoints } from '@/lib/pose/live-feedback';
import type { PoseAssessmentResult } from '@/lib/pose/assessment';
import { LM } from '@/lib/pose/reference';
function result(score=50,error=30): PoseAssessmentResult {
  return {status:'scored',message:'Comparison',score,comparedAngles:1,coverageRatio:1,comparedWeight:1,expectedWeight:1,referenceTimeMs:0,feedback:[],
    angleErrors:[{key:'kneeL',cameraKey:'kneeR',referenceDeg:90,cameraDeg:90+error,errorDeg:error,score,weight:1}]};
}
describe('stable live guidance', () => {
  it('smooths display jumps while preserving the raw observation for accumulation', () => {
    const state=createFeedbackState();updateLiveFeedback(state,result(0),0,5);const raw=result(100);
    const display=updateLiveFeedback(state,raw,100,5);expect(display.score!).toBeGreaterThan(0);expect(display.score!).toBeLessThan(100);expect(raw.score).toBe(100);
  });
  it('ignores brief deviations and highlights the actual camera side after 800ms', () => {
    const state=createFeedbackState();let hint;
    for(let t=0;t<=900;t+=100){hint=updateLiveFeedback(state,result(),t,5);if(t<800)expect(hint.cameraJoints).toEqual([]);}
    expect(hint!.cameraJoints).toEqual(['kneeR']);expect(hint!.referenceJoints).toEqual(['kneeL']);expect(hint!.message).toContain('правое колено');
    expect(highlightPoints(hint!.cameraJoints)).toEqual([LM.rKnee]);
  });
  it('respects the exercise tolerance and avoids directional or medical instructions', () => {
    const state=createFeedbackState();let hint;
    for(let t=0;t<=1200;t+=100)hint=updateLiveFeedback(state,result(80,30),t,25);
    expect(hint!.cameraJoints).toEqual([]);expect(hint!.message).not.toMatch(/согни|выпрям|безопас/i);
  });
  it('immediately removes old scores and highlights when visibility is lost or during rest', () => {
    for(const status of ['inactive','no_camera_pose','insufficient_visibility'] as const){
      const state=createFeedbackState();for(let t=0;t<=900;t+=100)updateLiveFeedback(state,result(),t,5);
      const display=updateLiveFeedback(state,{...result(),status,score:null},1000,5);
      expect(display.score).toBeNull();expect(display.cameraJoints).toEqual([]);expect(state.primary).toBeNull();
    }
  });
  it('does not carry a persistent deviation across a frozen or rewound camera clock', () => {
    for(const next of [3000,800]){const state=createFeedbackState();for(let t=0;t<=900;t+=100)updateLiveFeedback(state,result(),t,5);
      const display=updateLiveFeedback(state,result(),next,5);expect(display.cameraJoints).toEqual([]);}
  });
  it('highlights trunk points and deduplicates overlapping joint markers', () => {
    expect(highlightPoints(['trunk','hipL'])).toEqual([LM.lShoulder,LM.rShoulder,LM.lHip,LM.rHip]);
  });
});
