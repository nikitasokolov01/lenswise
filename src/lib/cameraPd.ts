/**
 * A local photo ruler, not a validated optical measuring device. A known-size
 * reference in the same plane as the pupils provides the pixel-to-mm scale.
 * The caller must have an optician verify the result before using it.
 */
export interface PhotoPoint {
  /** Position in the image, normalized from 0 to 1. */
  x: number;
  y: number;
}

export interface CameraPdLandmarks {
  referenceStart: PhotoPoint;
  referenceEnd: PhotoPoint;
  pupilStart: PhotoPoint;
  pupilEnd: PhotoPoint;
}

export type CameraPdResult =
  | { ok: true; binocularMm: number }
  | { ok: false; message: string };

export function estimateCameraPd(
  landmarks: CameraPdLandmarks,
  imageSize: { width: number; height: number },
  referenceMm: number,
): CameraPdResult {
  const { width, height } = imageSize;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 640 || height < 360) {
    return { ok: false, message: "Use a clearer photo, at least 640 × 360 pixels." };
  }
  if (!Number.isFinite(referenceMm) || referenceMm < 20 || referenceMm > 100) {
    return { ok: false, message: "Enter a known reference span between 20 and 100 mm." };
  }
  if (Object.values(landmarks).some((point) =>
    !Number.isFinite(point.x) || !Number.isFinite(point.y)
      || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1)) {
    return { ok: false, message: "Place all four marks inside the photo." };
  }

  const reference = {
    x: (landmarks.referenceEnd.x - landmarks.referenceStart.x) * width,
    y: (landmarks.referenceEnd.y - landmarks.referenceStart.y) * height,
  };
  const pupils = {
    x: (landmarks.pupilEnd.x - landmarks.pupilStart.x) * width,
    y: (landmarks.pupilEnd.y - landmarks.pupilStart.y) * height,
  };
  const referencePixels = Math.hypot(reference.x, reference.y);
  const pupilPixels = Math.hypot(pupils.x, pupils.y);
  if (referencePixels < 100 || pupilPixels < 60) {
    return { ok: false, message: "The marks are too close together. Take a closer, clearer photo." };
  }
  // Both spans must be nearly horizontal and parallel. This rejects visibly
  // tilted captures; it cannot detect depth mismatch or camera distortion.
  const referenceTilt = Math.atan2(Math.abs(reference.y), Math.abs(reference.x));
  const pupilTilt = Math.atan2(Math.abs(pupils.y), Math.abs(pupils.x));
  const parallelCosine = Math.abs(reference.x * pupils.x + reference.y * pupils.y)
    / (referencePixels * pupilPixels);
  if (referenceTilt > Math.PI / 18 || pupilTilt > Math.PI / 18
    || parallelCosine < Math.cos(Math.PI / 18)) {
    return { ok: false, message: "Retake the photo with the head and reference level, facing straight toward the camera." };
  }

  const binocularMm = Math.round(pupilPixels / referencePixels * referenceMm * 10) / 10;
  if (binocularMm < 35 || binocularMm > 85) {
    return { ok: false, message: "The estimate is outside 35–85 mm. Recheck the reference span and pupil marks, or enter a manual PD." };
  }
  return { ok: true, binocularMm };
}
