/* LensWise's worker adapter. Vendored MediaPipe library/model: Apache-2.0. */
"use strict";

let landmarkerPromise;

function createLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      if (typeof OffscreenCanvas === "undefined") throw new Error("This browser cannot run local pupil detection. Place the pupil marks manually.");
      importScripts("/vision/mediapipe-1.1.0/vision_bundle.js");
      const files = await Vision.FilesetResolver.forVisionTasks("/vision/mediapipe-1.1.0/wasm");
      return Vision.FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: "/vision/face_landmarker-v1.task", delegate: "CPU" },
        canvas: new OffscreenCanvas(1, 1),
        runningMode: "IMAGE",
        numFaces: 2,
        minFaceDetectionConfidence: 0.7,
        minFacePresenceConfidence: 0.7,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });
    })();
  }
  return landmarkerPromise;
}

// Laplacian variance is only a coarse blur rejection, never an accuracy score.
function eyeSharpness(bitmap, center, eyeWidth) {
  const cropWidth = eyeWidth * bitmap.width * 1.6;
  const cropHeight = cropWidth * 0.7;
  const canvas = new OffscreenCanvas(96, 64);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return 0;
  context.drawImage(bitmap,
    Math.max(0, center.x * bitmap.width - cropWidth / 2),
    Math.max(0, center.y * bitmap.height - cropHeight / 2),
    cropWidth, cropHeight, 0, 0, 96, 64);
  const pixels = context.getImageData(0, 0, 96, 64).data;
  const gray = new Float32Array(96 * 64);
  for (let i = 0; i < gray.length; i += 1) {
    gray[i] = pixels[i * 4] * 0.299 + pixels[i * 4 + 1] * 0.587 + pixels[i * 4 + 2] * 0.114;
  }
  let sum = 0;
  let squares = 0;
  let count = 0;
  for (let y = 1; y < 63; y += 1) {
    for (let x = 1; x < 95; x += 1) {
      const i = y * 96 + x;
      const value = gray[i - 1] + gray[i + 1] + gray[i - 96] + gray[i + 96] - 4 * gray[i];
      sum += value;
      squares += value * value;
      count += 1;
    }
  }
  return squares / count - (sum / count) ** 2;
}

self.onmessage = async (event) => {
  const { id, bitmap } = event.data;
  let model;
  try {
    model = await createLandmarker();
    const result = model.detect(bitmap);
    const faces = result.faceLandmarks;
    let sharpness = null;
    if (faces.length === 1 && faces[0].length >= 478) {
      const points = faces[0];
      sharpness = [
        eyeSharpness(bitmap, points[468], Math.abs(points[33].x - points[133].x)),
        eyeSharpness(bitmap, points[473], Math.abs(points[263].x - points[362].x)),
      ];
    }
    self.postMessage({ id, ok: true, faces, sharpness });
  } catch (error) {
    try { model?.close(); } catch { /* The worker is discarded if teardown fails. */ }
    landmarkerPromise = undefined;
    self.postMessage({ id, ok: false, message: error instanceof Error ? error.message : "Local pupil detection could not run." });
  } finally {
    bitmap?.close();
  }
};
