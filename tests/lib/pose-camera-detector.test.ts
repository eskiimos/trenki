import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCameraDetector, createWorkerDetector, createMainDetector } from '@/components/admin/pose/camera-detector';
import { createLandmarker } from '@/components/admin/pose/landmarker';
vi.mock('@/components/admin/pose/landmarker', () => ({ createLandmarker: vi.fn() }));
class FakeWorker {
  static instances: FakeWorker[] = [];
  static ready = true;
  onmessage: ((event: {data: unknown}) => void) | null = null;
  onerror: ((event: {preventDefault: () => void}) => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn((data: {type:string}) => {if(data.type==='init'&&FakeWorker.ready)queueMicrotask(()=>this.emit({type:'ready',delegate:'GPU'}));});
  constructor(){FakeWorker.instances.push(this);}
  emit(data: unknown){this.onmessage?.({data});}
}
const video={} as HTMLVideoElement;
const bitmap={width:640,height:360,close:vi.fn()};
const model={delegate:'CPU' as const,detectForVideo:vi.fn(()=>({landmarks:[]})),close:vi.fn()};
beforeEach(()=>{
  FakeWorker.instances=[];FakeWorker.ready=true;vi.clearAllMocks();
  vi.stubGlobal('Worker',FakeWorker);vi.stubGlobal('OffscreenCanvas',class {});
  vi.stubGlobal('createImageBitmap',vi.fn().mockResolvedValue(bitmap));vi.mocked(createLandmarker).mockResolvedValue(model);
});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
describe('local camera detector transport',()=>{
  it('transfers a single bitmap with its capture timestamp, without accumulating frames',async()=>{
    const detector=await createWorkerDetector(new AbortController().signal);const worker=FakeWorker.instances[0]!;
    const detection=detector.detect(video,1234);await Promise.resolve();
    await expect(detector.detect(video,1235)).rejects.toThrow('already in progress');
    expect(worker.postMessage).toHaveBeenLastCalledWith({type:'frame',id:1,bitmap,timestampMs:1234},[bitmap]);
    worker.emit({type:'result',id:1,result:{landmarks:[]}});expect(await detection).toEqual({landmarks:[]});detector.close();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('does not accept late or mismatched responses for another frame',async()=>{
    const detector=await createWorkerDetector(new AbortController().signal);const worker=FakeWorker.instances[0]!;
    const pending=detector.detect(video,100);await Promise.resolve();let settled=false;void pending.then(()=>settled=true);
    worker.emit({type:'result',id:999,result:{}});await Promise.resolve();expect(settled).toBe(false);
    worker.emit({type:'result',id:1,result:{landmarks:[]}});await pending;detector.close();
  });
  it('aborting an in-flight frame terminates the worker and rejects the pending observation',async()=>{
    const controller=new AbortController();const detector=await createWorkerDetector(controller.signal);
    const pending=detector.detect(video,100);await Promise.resolve();const assertion=expect(pending).rejects.toMatchObject({name:'AbortError'});
    controller.abort();await assertion;expect(FakeWorker.instances[0]!.terminate).toHaveBeenCalledOnce();
  });
  it('closes a bitmap created after the camera has been stopped',async()=>{
    let resolveBitmap!:(b:typeof bitmap)=>void;vi.mocked(createImageBitmap).mockImplementation(()=>new Promise(resolve=>{resolveBitmap=resolve}));
    const detector=await createWorkerDetector(new AbortController().signal);const pending=detector.detect(video,100);
    detector.close();resolveBitmap(bitmap);await expect(pending).rejects.toMatchObject({name:'AbortError'});expect(bitmap.close).toHaveBeenCalledOnce();
  });
  it('falls back to the main detector when worker capabilities are absent',async()=>{
    vi.stubGlobal('OffscreenCanvas',undefined);const detector=await createCameraDetector(new AbortController().signal);
    expect(detector.execution).toBe('main');expect(FakeWorker.instances).toHaveLength(0);await detector.detect(video,200);
    expect(model.detectForVideo).toHaveBeenCalledWith(video,200);detector.close();expect(model.close).toHaveBeenCalledOnce();
  });
  it('falls back after worker initialization errors and terminates the failed worker',async()=>{
    FakeWorker.ready=false;const pending=createCameraDetector(new AbortController().signal);const worker=FakeWorker.instances[0]!;
    worker.onerror?.({preventDefault:vi.fn()});expect((await pending).execution).toBe('main');expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('times out initialization and inference rather than hanging the camera indefinitely',async()=>{
    vi.useFakeTimers();FakeWorker.ready=false;const initialized=createCameraDetector(new AbortController().signal);
    await vi.advanceTimersByTimeAsync(30000);expect((await initialized).execution).toBe('main');
    FakeWorker.ready=true;const detectorPromise=createWorkerDetector(new AbortController().signal);await vi.advanceTimersByTimeAsync(0);const detector=await detectorPromise;
    const pending=detector.detect(video,100);const assertion=expect(pending).rejects.toThrow('timeout');await vi.advanceTimersByTimeAsync(3000);await assertion;detector.close();
  });
  it('does not leave a main-thread model alive when camera cancellation races model loading',async()=>{
    const controller=new AbortController();let resolveModel!:(m:typeof model)=>void;
    vi.mocked(createLandmarker).mockImplementation(()=>new Promise(resolve=>{resolveModel=resolve}));
    const pending=createMainDetector(controller.signal);controller.abort();resolveModel(model);
    await expect(pending).rejects.toMatchObject({name:'AbortError'});expect(model.close).toHaveBeenCalledOnce();
  });
});
