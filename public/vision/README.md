# Local pupil marker assets

LensWise uses MediaPipe only to suggest iris-center positions on a selected or
captured photo. It does not use predicted depth, average iris diameter, a face
model's scale, or apparent head size to calculate physical PD.

- `@mediapipe/tasks-vision` is pinned to **1.1.0** in package.json/lock.
- `mediapipe-1.1.0/` contains the unmodified classic browser bundle and all
  SIMD/non-SIMD/module WASM variants from that npm package.
- `face_landmarker-v1.task` is the fixed revision **1**, float16 model from
  <https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task>.
- `MEDIAPIPE_LICENSE` contains Google's Apache-2.0 license and notices.
- `FACE_MESH_MODEL_CARD.pdf` is the official model card from
  <https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Face%20Mesh%20V2.pdf>.
- `pupil-worker.js` is LensWise's worker adapter. It performs single-image
  inference with the CPU delegate, accepts only a transferred local ImageBitmap,
  and returns image landmarks and coarse eye-region sharpness metrics.

The model and runtime load from the same LensWise host only after the camera PD
feature receives a local photo. There are no third-party runtime downloads,
image uploads, or continuous face tracking. Closing the feature terminates the
worker, stops the camera, and revokes the local image URL. Native camera/file
capture may also leave a separate photo on the user's device.

The total deployment asset footprint is approximately 45 MB; the active browser
loads one selected WASM variant (~12–13 MB), the model (~3.8 MB), and small JS
files. The model card and unused runtime variants are not loaded during a scan.

Official API guidance:
<https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js>

Iris center indices 468 and 473 come from Google's reference graph:
<https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_landmark/tensors_to_face_landmarks_with_attention.pbtxt>.
