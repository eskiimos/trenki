"""Decode once, infer at 10 fps, write the existing PoseReferenceDoc format."""
import argparse
import json
import math
import os
import subprocess
import sys

def emit(event, **data):
    print(json.dumps(dict(event=event, **data)), flush=True)

def integer(value, lo, hi):
    # Same rounding as JavaScript Math.round, including negative world coordinates.
    return max(lo, min(hi, math.floor(value + 0.5)))

def encode_frame(t_ms, landmarks, world):
    if len(landmarks) != 33 or len(world) != 33:
        return [t_ms]
    frame = [t_ms]
    for p in landmarks:
        frame.extend([integer(p.x * 1000, -500, 1500), integer(p.y * 1000, -500, 1500), integer((p.visibility or 0) * 100, 0, 100)])
    for p in world:
        frame.extend([integer(p.x * 1000, -3000, 3000), integer(p.y * 1000, -3000, 3000), integer(p.z * 1000, -3000, 3000)])
    return frame

def analyze(args):
    import cv2
    import numpy as np
    import mediapipe as mp
    cv2.setNumThreads(1)
    probe = subprocess.run(['ffprobe', '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', args.input], check=True, capture_output=True, text=True, timeout=60)
    data = json.loads(probe.stdout)
    video = next((s for s in data['streams'] if s['codec_type'] == 'video' and not s.get('disposition', {}).get('attached_pic')), None)
    duration = float(data.get('format', {}).get('duration', 0))
    if video is None or not math.isfinite(duration) or not 0 < duration <= 2400:
        emit('invalid', error='Нужен видеофайл длительностью до 40 минут')
        return 2
    width, height = int(video['width']), int(video['height'])
    # ffmpeg autorotation makes coordinates match the display in the browser.
    rotation = next((s.get('rotation', 0) for s in video.get('side_data_list', []) if 'rotation' in s), 0)
    if abs(int(rotation)) % 180 == 90:
        width, height = height, width
    scaled_w = max(2, math.floor(width * min(1, 960 / max(width, height)) / 2) * 2)
    scaled_h = max(2, math.floor(height * min(1, 960 / max(width, height)) / 2) * 2)
    options = mp.tasks.vision.PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=args.model, delegate=mp.tasks.BaseOptions.Delegate.CPU),
        running_mode=mp.tasks.vision.RunningMode.VIDEO, num_poses=1,
        min_pose_detection_confidence=0.5, min_pose_presence_confidence=0.5, min_tracking_confidence=0.5)
    frames = []
    decoder = None
    try:
        with mp.tasks.vision.PoseLandmarker.create_from_options(options) as detector:
            decoder = subprocess.Popen(['ffmpeg', '-v', 'error', '-threads', '1', '-i', args.input,
                '-map', f"0:{video['index']}", '-an', '-vf', f'fps=10:start_time=0,scale={scaled_w}:{scaled_h}',
                '-filter_threads', '1', '-t', str(duration), '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'],
                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            size = scaled_w * scaled_h * 3
            while True:
                raw = decoder.stdout.read(size)
                if not raw:
                    break
                if len(raw) != size or len(frames) >= 24000:
                    raise ValueError('Incomplete frame or reference limit exceeded')
                pixels = np.frombuffer(raw, dtype=np.uint8).reshape(scaled_h, scaled_w, 3)
                t_ms = len(frames) * 100
                result = detector.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=pixels), t_ms)
                frames.append(encode_frame(t_ms, result.pose_landmarks[0] if result.pose_landmarks else [],
                    result.pose_world_landmarks[0] if result.pose_world_landmarks else []))
                if len(frames) % 10 == 0:
                    emit('progress', percent=min(99, len(frames) / (duration * 10) * 100))
            if decoder.wait(timeout=30) != 0 or not frames or len(frames) < max(1, math.floor(duration * 10) - 1):
                raise ValueError('Video decoding incomplete')
        doc = dict(v=1, model='pose_landmarker_heavy', fps=10, durationMs=round(duration * 1000),
            width=width, height=height, frames=frames)
        with open(args.output, 'x', encoding='utf-8') as target:
            json.dump(doc, target, separators=(',', ':'))
        emit('progress', percent=99)
        return 0
    finally:
        if decoder is not None:
            if decoder.poll() is None:
                decoder.terminate()
                try:
                    decoder.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    decoder.kill()
                    decoder.wait()
            decoder.stdout.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--model', required=True)
    args = parser.parse_args()
    os.umask(0o077)
    sys.exit(analyze(args))
