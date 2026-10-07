import { describe, expect, it } from "vitest";
import { cameraPdPhotoSize, estimateCameraPd, type CameraPdLandmarks } from "@/lib/cameraPd";

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

describe("local camera photo bounds", () => {
  it("resizes a routine 12 MP iPhone photo uniformly", () => {
    expect(cameraPdPhotoSize(4032, 3024)).toEqual({ width: 2400, height: 1800 });
    expect(cameraPdPhotoSize(3024, 4032)).toEqual({ width: 1800, height: 2400 });
  });

  it("keeps an already bounded photo unchanged", () => {
    expect(cameraPdPhotoSize(1280, 720)).toEqual({ width: 1280, height: 720 });
  });

  it("supports a 48 MP capture without passing its full area to inference", () => {
    expect(cameraPdPhotoSize(8064, 6048)).toEqual({ width: 2400, height: 1800 });
  });

  it("retains the calibrated ratio after a uniform local resize", () => {
    const original = { width: 4032, height: 3024 };
    const resized = cameraPdPhotoSize(original.width, original.height)!;
    expect(estimateCameraPd(landmarks, resized, 50)).toEqual(estimateCameraPd(landmarks, original, 50));
  });

  it("rejects invalid or abnormally huge decoded dimensions", () => {
    for (const [width, height] of [[0, 1000], [Number.NaN, 1000], [Infinity, 1000], [20_000, 1000], [10_000, 10_000]]) {
      expect(cameraPdPhotoSize(width, height)).toBeNull();
    }
  });
});
