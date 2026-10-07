import type { PhotoPoint } from "@/lib/cameraPd";

export interface PupilDetectionOutput {
  ok: boolean;
  faces?: PhotoPoint[][];
  sharpness?: [number, number] | null;
  message?: string;
}

/** Only image-space suggestions. These landmarks have no physical mm scale. */
export type SuggestedPupils =
  | { ok: true; imageLeft: PhotoPoint; imageRight: PhotoPoint }
  | { ok: false; message: string };

export function validateSuggestedPupils(
  output: PupilDetectionOutput,
  image: { width: number; height: number },
): SuggestedPupils {
  if (!Number.isFinite(image.width) || !Number.isFinite(image.height)
    || image.width <= 0 || image.height <= 0) {
    return { ok: false, message: "This photo has invalid dimensions. Choose another photo or place the marks manually." };
  }
  if (!output.ok) return { ok: false, message: output.message || "Local pupil detection could not run. Place the marks manually." };
  const faces = output.faces ?? [];
  if (faces.length === 0) return { ok: false, message: "No face was found. Use even lighting and a clear photo, or place the pupil marks manually." };
  if (faces.length !== 1) return { ok: false, message: "More than one face was found. Retake the photo with only the patient visible." };
  const face = faces[0];
  const required = [1, 33, 133, 159, 145, 263, 362, 386, 374, 468, 469, 471, 473, 474, 476];
  if (face.length < 478 || required.some((index) => {
    const point = face[index];
    return !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)
      || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1;
  })) return { ok: false, message: "The face or eyes are cut off. Retake a centered photo or place the marks manually." };

  const [imageLeft, imageRight] = [face[468], face[473]].sort((a, b) => a.x - b.x);
  const pupilSpan = (imageRight.x - imageLeft.x) * image.width;
  const tilt = Math.atan2(Math.abs(imageRight.y - imageLeft.y) * image.height, pupilSpan);
  const eyeWidths = [Math.abs(face[33].x - face[133].x), Math.abs(face[263].x - face[362].x)];
  const irisWidths = [Math.abs(face[469].x - face[471].x), Math.abs(face[474].x - face[476].x)];
  const noseFraction = (face[1].x - imageLeft.x) / (imageRight.x - imageLeft.x);
  const eyeRatio = eyeWidths[0] / eyeWidths[1];
  if (pupilSpan < 60 || eyeWidths.some((width) => width * image.width < 25)
    || irisWidths.some((width) => width * image.width < 6)) {
    return { ok: false, message: "The eyes are too small in this photo. Take a closer, sharper photo." };
  }
  if (tilt > Math.PI * 8 / 180 || eyeRatio < 0.55 || eyeRatio > 1.8
    || noseFraction < 0.3 || noseFraction > 0.7) {
    return { ok: false, message: "The head appears tilted or turned. Retake the photo facing straight toward the camera." };
  }
  const openings = [Math.abs(face[159].y - face[145].y), Math.abs(face[386].y - face[374].y)];
  if (openings.some((height, index) => height * image.height / (eyeWidths[index] * image.width) < 0.12)) {
    return { ok: false, message: "The eyes appear closed or partly obscured. Retake with both pupils clearly visible." };
  }
  if (output.sharpness && output.sharpness.some((score) => !Number.isFinite(score) || score < 12)) {
    return { ok: false, message: "The eye areas look blurred or low contrast. Retake in better light, keeping the camera steady." };
  }
  return { ok: true, imageLeft: { x: imageLeft.x, y: imageLeft.y }, imageRight: { x: imageRight.x, y: imageRight.y } };
}

/** A dedicated worker keeps WASM inference off the page's UI thread. */
export class LocalPupilDetector {
  private worker: Worker | null = null;
  private nextId = 0;
  private activeId: number | null = null;
  private lifecycle = 0;
  private pending: { reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;

  async detect(photoUrl: string): Promise<PupilDetectionOutput> {
    if (this.activeId !== null) throw new Error("Pupil detection is already running.");
    if (typeof Worker === "undefined" || typeof createImageBitmap === "undefined") {
      throw new Error("This browser does not support local pupil detection. Place the marks manually.");
    }
    // Only a component-owned blob URL is accepted, never an upload endpoint.
    if (!photoUrl.startsWith("blob:")) throw new Error("Use a local captured or selected photo.");
    const id = ++this.nextId;
    this.activeId = id;
    const lifecycle = this.lifecycle;
    try {
      const blob = await (await fetch(photoUrl)).blob();
      const bitmap = await createImageBitmap(blob);
      if (lifecycle !== this.lifecycle) {
        bitmap.close();
        throw new Error("Pupil detection stopped.");
      }
      try {
        if (!this.worker) this.worker = new Worker("/vision/pupil-worker.js");
      } catch {
        bitmap.close();
        throw new Error("This browser could not start the local detector. Place the marks manually.");
      }
      const worker = this.worker;
      return await new Promise<PupilDetectionOutput>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.dispose();
        }, 45_000);
        this.pending = { reject, timer };
        const finish = () => { clearTimeout(timer); this.pending = null; };
        worker.onmessage = (event: MessageEvent<PupilDetectionOutput & { id: number }>) => {
          if (event.data.id !== id) return;
          finish();
          resolve(event.data);
        };
        worker.onerror = () => {
          finish();
          worker.terminate();
          this.worker = null;
          reject(new Error("Local pupil detection could not start. Place the marks manually or try a different browser."));
        };
        try {
          worker.postMessage({ id, bitmap }, [bitmap]);
        } catch {
          bitmap.close();
          finish();
          reject(new Error("This browser could not process the photo locally. Place the marks manually."));
        }
      });
    } finally {
      if (this.activeId === id) this.activeId = null;
    }
  }

  dispose() {
    this.lifecycle += 1;
    this.activeId = null;
    this.worker?.terminate();
    this.worker = null;
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(new Error("Pupil detection stopped. Retry or place the marks manually."));
      this.pending = null;
    }
  }
}
