import { describe, expect, it } from "vitest";
import { estimateCameraPd, type CameraPdLandmarks } from "@/lib/cameraPd";

const image = { width: 1000, height: 1000 };
const landmarks: CameraPdLandmarks = {
  referenceStart: { x: 0.2, y: 0.6 },
  referenceEnd: { x: 0.7, y: 0.6 },
  pupilStart: { x: 0.15, y: 0.4 },
  pupilEnd: { x: 0.78, y: 0.4 },
};

describe("calibrated camera PD estimate", () => {
  it("converts marked pupil distance using a known ruler span", () => {
    expect(estimateCameraPd(landmarks, image, 50)).toEqual({ ok: true, binocularMm: 63 });
  });

  it("uses image pixel dimensions rather than assuming a square photo", () => {
    expect(estimateCameraPd(landmarks, { width: 2000, height: 1000 }, 50))
      .toEqual({ ok: true, binocularMm: 63 });
  });

  it("does not depend on which endpoint was marked first", () => {
    expect(estimateCameraPd({ ...landmarks, referenceStart: landmarks.referenceEnd, referenceEnd: landmarks.referenceStart }, image, 50))
      .toEqual({ ok: true, binocularMm: 63 });
  });

  it("rounds to the single decimal accepted by the quote PD field", () => {
    expect(estimateCameraPd({ ...landmarks, pupilEnd: { x: 0.7833, y: 0.4 } }, image, 50))
      .toEqual({ ok: true, binocularMm: 63.3 });
  });

  it.each([0, -10, Number.NaN, Number.POSITIVE_INFINITY, 101])("rejects an invalid reference span %s", (span) => {
    expect(estimateCameraPd(landmarks, image, span).ok).toBe(false);
  });

  it("rejects a photo too small to measure", () => {
    expect(estimateCameraPd(landmarks, { width: 320, height: 240 }, 50).ok).toBe(false);
  });

  it("rejects coincident reference marks", () => {
    expect(estimateCameraPd({ ...landmarks, referenceEnd: landmarks.referenceStart }, image, 50).ok).toBe(false);
  });

  it("rejects marks outside the image", () => {
    expect(estimateCameraPd({ ...landmarks, pupilStart: { x: -0.1, y: 0.4 } }, image, 50).ok).toBe(false);
  });

  it("rejects a tilted reference and visibly tilted head", () => {
    expect(estimateCameraPd({ ...landmarks, referenceEnd: { x: 0.7, y: 0.8 } }, image, 50).ok).toBe(false);
    expect(estimateCameraPd({ ...landmarks, pupilEnd: { x: 0.78, y: 0.6 } }, image, 50).ok).toBe(false);
  });

  it("rejects implausible estimates instead of clamping them", () => {
    expect(estimateCameraPd(landmarks, image, 100).ok).toBe(false);
  });
});
