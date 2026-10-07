import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalPupilDetector, validateSuggestedPupils, type PupilDetectionOutput } from "@/lib/pupilDetection";
import type { PhotoPoint } from "@/lib/cameraPd";

function fixture(): PupilDetectionOutput {
  const face: PhotoPoint[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  face[1] = { x: 0.5, y: 0.55 };
  face[33] = { x: 0.29, y: 0.4 };
  face[133] = { x: 0.41, y: 0.4 };
  face[159] = { x: 0.35, y: 0.37 };
  face[145] = { x: 0.35, y: 0.43 };
  face[263] = { x: 0.71, y: 0.4 };
  face[362] = { x: 0.59, y: 0.4 };
  face[386] = { x: 0.65, y: 0.37 };
  face[374] = { x: 0.65, y: 0.43 };
  face[468] = { x: 0.35, y: 0.4 };
  face[469] = { x: 0.37, y: 0.4 };
  face[471] = { x: 0.33, y: 0.4 };
  face[473] = { x: 0.65, y: 0.4 };
  face[474] = { x: 0.67, y: 0.4 };
  face[476] = { x: 0.63, y: 0.4 };
  return { ok: true, faces: [face], sharpness: [50, 60] };
}

describe("local pupil landmark suggestions", () => {
  const image = { width: 1000, height: 1000 };

  it("returns image positions, never physical PD or a fabricated depth", () => {
    const output = fixture();
    Object.assign(output.faces![0][468], { z: -0.04 });
    expect(validateSuggestedPupils(output, image)).toEqual({
      ok: true, imageLeft: { x: 0.35, y: 0.4 }, imageRight: { x: 0.65, y: 0.4 },
    });
  });

  it("orders marks by the photo rather than assuming patient right/left", () => {
    const output = fixture();
    [output.faces![0][468], output.faces![0][473]] = [output.faces![0][473], output.faces![0][468]];
    expect(validateSuggestedPupils(output, image)).toEqual({
      ok: true, imageLeft: { x: 0.35, y: 0.4 }, imageRight: { x: 0.65, y: 0.4 },
    });
  });

  it("rejects no face, multiple faces, or missing iris landmarks", () => {
    expect(validateSuggestedPupils({ ok: true, faces: [] }, image).ok).toBe(false);
    expect(validateSuggestedPupils({ ok: true, faces: [fixture().faces![0], fixture().faces![0]] }, image).ok).toBe(false);
    expect(validateSuggestedPupils({ ok: true, faces: [fixture().faces![0].slice(0, 468)] }, image).ok).toBe(false);
  });

  it("rejects cropped or nonfinite pupil positions", () => {
    for (const x of [-0.1, 1.1, Number.NaN]) {
      const output = fixture();
      output.faces![0][468].x = x;
      expect(validateSuggestedPupils(output, image).ok).toBe(false);
    }
  });

  it("rejects invalid image dimensions", () => {
    expect(validateSuggestedPupils(fixture(), { width: Number.NaN, height: 1000 }).ok).toBe(false);
    expect(validateSuggestedPupils(fixture(), { width: 1000, height: 0 }).ok).toBe(false);
  });

  it("rejects a visibly tilted head", () => {
    const output = fixture();
    output.faces![0][473].y = 0.5;
    expect(validateSuggestedPupils(output, image).ok).toBe(false);
  });

  it("rejects obviously turned head geometry", () => {
    const output = fixture();
    output.faces![0][1].x = 0.7;
    expect(validateSuggestedPupils(output, image).ok).toBe(false);
  });

  it("rejects closed eyes, small eyes, or low-contrast eye regions", () => {
    const output = fixture();
    output.faces![0][159].y = output.faces![0][145].y;
    expect(validateSuggestedPupils(output, image).ok).toBe(false);
    expect(validateSuggestedPupils(fixture(), { width: 100, height: 100 }).ok).toBe(false);
    expect(validateSuggestedPupils({ ...fixture(), sharpness: [1, 1] }, image).ok).toBe(false);
  });

  it("provides manual fallback when the local worker cannot run", () => {
    expect(validateSuggestedPupils({ ok: false, message: "Browser cannot run model" }, image))
      .toEqual({ ok: false, message: "Browser cannot run model" });
  });
});

describe("local pupil detector lifecycle", () => {
  let detector: LocalPupilDetector | undefined;
  let worker: FakeWorker | undefined;
  const bitmap = { close: vi.fn() };

  class FakeWorker {
    onmessage: ((event: { data: PupilDetectionOutput & { id: number } }) => void) | null = null;
    onerror: (() => void) | null = null;
    terminate = vi.fn();
    postMessage = vi.fn();
    constructor() { worker = this; }
  }

  function setup() {
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ blob: () => Promise.resolve(new Blob()) }));
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    detector = new LocalPupilDetector();
    return detector;
  }

  async function readyWorker() {
    await vi.waitFor(() => expect(worker?.postMessage).toHaveBeenCalled());
    return worker!;
  }

  afterEach(() => {
    detector?.dispose();
    detector = undefined;
    worker = undefined;
    bitmap.close.mockClear();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("accepts only local photos and does not create a worker before use", async () => {
    const local = setup();
    expect(worker).toBeUndefined();
    await expect(local.detect("https://example.com/photo.jpg")).rejects.toThrow("local");
    expect(fetch).not.toHaveBeenCalled();
    expect(worker).toBeUndefined();
  });

  it("transfers a local bitmap and returns worker suggestions", async () => {
    const pending = setup().detect("blob:local-photo");
    const active = await readyWorker();
    const { id } = active.postMessage.mock.calls[0][0];
    expect(active.postMessage.mock.calls[0][1]).toEqual([bitmap]);
    active.onmessage!({ data: { id, ok: true, faces: [] } });
    await expect(pending).resolves.toEqual({ id, ok: true, faces: [] });
  });

  it("blocks a concurrent request even during the local decode", async () => {
    const local = setup();
    const pending = local.detect("blob:local-photo");
    await expect(local.detect("blob:second-photo")).rejects.toThrow("already running");
    const active = await readyWorker();
    const { id } = active.postMessage.mock.calls[0][0];
    active.onmessage!({ data: { id, ok: true, faces: [] } });
    await pending;
  });

  it("closes the decoded bitmap when the feature closes before inference", async () => {
    const local = setup();
    const pending = local.detect("blob:local-photo");
    local.dispose();
    await expect(pending).rejects.toThrow("stopped");
    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(worker).toBeUndefined();
  });

  it("terminates an active worker and rejects safely on close", async () => {
    const local = setup();
    const pending = local.detect("blob:local-photo");
    const active = await readyWorker();
    local.dispose();
    await expect(pending).rejects.toThrow("stopped");
    expect(active.terminate).toHaveBeenCalledOnce();
  });

  it("provides manual fallback and terminates a failed worker", async () => {
    const pending = setup().detect("blob:local-photo");
    const active = await readyWorker();
    active.onerror!();
    await expect(pending).rejects.toThrow("manually");
    expect(active.terminate).toHaveBeenCalledOnce();
  });
});
