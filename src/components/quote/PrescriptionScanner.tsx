"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Camera, Check, Loader2, RotateCw, ScanLine, Upload, X } from "lucide-react";
import type { Worker } from "tesseract.js";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ADD_OPTIONS, AXIS_OPTIONS, CYLINDER_OPTIONS, SPHERE_OPTIONS } from "@/lib/prescriptionOptions";
import {
  parsePrescriptionScan,
  reviewedScanPrescription,
  type PrescriptionScanResult,
  type ReviewedPrescriptionScan,
  type ScannedEyeValues,
} from "@/lib/prescriptionScan";
import { sanitizePupillaryDistanceValue } from "@/lib/pupillaryDistance";

interface Crop { left: number; top: number; width: number; height: number }
const FULL_CROP: Crop = { left: 0, top: 0, width: 1, height: 1 };

function canvasFromImage(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const scale = Math.min(1, 2400 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing is unavailable in this browser.");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** On-device OCR. Images, recognized text, and review drafts live only in memory. */
export function PrescriptionScanner({ onReviewed }: { onReviewed: (scan: ReviewedPrescriptionScan) => void }) {
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<HTMLCanvasElement | null>(null);
  const [crop, setCrop] = useState<Crop>(FULL_CROP);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<PrescriptionScanResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [includePd, setIncludePd] = useState(true);
  const photoInput = useRef<HTMLInputElement>(null);
  const captureInput = useRef<HTMLInputElement>(null);
  const previewCanvas = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const worker = useRef<Worker | null>(null);
  const epoch = useRef(0);
  const cropStart = useRef<{ x: number; y: number } | null>(null);

  function stopCamera() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setCameraOpen(false);
    setCameraStarting(false);
  }

  function cancelScan() {
    epoch.current += 1;
    void worker.current?.terminate();
    worker.current = null;
    setBusy(false);
  }

  function close() {
    cancelScan();
    stopCamera();
    setImage(null);
    setResult(null);
    setError("");
    setConfirmed(false);
    setOpen(false);
  }

  useEffect(() => () => {
    epoch.current += 1;
    stream.current?.getTracks().forEach((track) => track.stop());
    void worker.current?.terminate();
  }, []);

  useEffect(() => {
    if (!cameraOpen || !video.current || !stream.current) return;
    video.current.srcObject = stream.current;
    void video.current.play().catch(() => setError("Tap the camera preview to start it, or choose a photo instead."));
  }, [cameraOpen]);

  useEffect(() => {
    const canvas = previewCanvas.current;
    if (!canvas || !image) return;
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext("2d")?.drawImage(image, 0, 0);
  }, [image, result]);

  function showImage(canvas: HTMLCanvasElement) {
    stopCamera();
    setImage(canvas);
    setCrop(FULL_CROP);
    setResult(null);
    setConfirmed(false);
    setError("");
  }

  async function loadPhoto(file: File | undefined) {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Choose a photo (JPG, PNG, or WebP). PDF documents are not supported by this scanner.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError("This photo is too large. Choose one smaller than 25 MB.");
      return;
    }
    const photoEpoch = ++epoch.current;
    const url = URL.createObjectURL(file);
    try {
      const loaded = new Image();
      loaded.src = url;
      await loaded.decode();
      if (photoEpoch !== epoch.current) return;
      showImage(canvasFromImage(loaded, loaded.naturalWidth, loaded.naturalHeight));
    } catch {
      setError("This photo could not be opened. Try a JPG or take a new photo with the camera.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function startCamera() {
    setError("");
    // Native capture also works when testing on a phone over a local HTTP IP.
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      captureInput.current?.click();
      return;
    }
    const cameraEpoch = ++epoch.current;
    setCameraStarting(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      if (cameraEpoch !== epoch.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      setImage(null);
      setResult(null);
      setCameraOpen(true);
    } catch {
      setError("Camera access was denied or no camera is available. Allow camera access or use Take a photo / Choose photo.");
    } finally {
      setCameraStarting(false);
    }
  }

  function capturePhoto() {
    if (!video.current?.videoWidth) {
      setError("The camera is still starting. Wait a moment and try again.");
      return;
    }
    showImage(canvasFromImage(video.current, video.current.videoWidth, video.current.videoHeight));
  }

  function rotatePhoto() {
    if (!image) return;
    const rotated = document.createElement("canvas");
    rotated.width = image.height;
    rotated.height = image.width;
    const context = rotated.getContext("2d");
    if (!context) return;
    context.translate(rotated.width, 0);
    context.rotate(Math.PI / 2);
    context.drawImage(image, 0, 0);
    setImage(rotated);
    setCrop(FULL_CROP);
  }

  function pointerPosition(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    };
  }

  function startCrop(event: PointerEvent<HTMLDivElement>) {
    if (busy || result) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    cropStart.current = pointerPosition(event);
  }

  function dragCrop(event: PointerEvent<HTMLDivElement>) {
    if (!cropStart.current || busy || result) return;
    const end = pointerPosition(event);
    const start = cropStart.current;
    setCrop({ left: Math.min(start.x, end.x), top: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) });
  }

  function finishCrop() {
    cropStart.current = null;
    setCrop((current) => current.width < 0.03 || current.height < 0.03 ? FULL_CROP : current);
  }

  async function scanPhoto() {
    if (!image) return;
    setBusy(true);
    setError("");
    setProgress(0);
    setStatus("Loading the on-device scanner…");
    const scanEpoch = ++epoch.current;
    let scanWorker: Worker | null = null;
    const timeout = window.setTimeout(() => {
      if (scanEpoch !== epoch.current) return;
      cancelScan();
      setError("The scan took too long. Crop closely around the prescription table and try again.");
    }, 90000);
    try {
      const { createWorker, OEM, PSM } = await import("tesseract.js");
      if (scanEpoch !== epoch.current) return;
      scanWorker = await createWorker("eng", OEM.LSTM_ONLY, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr/core",
        langPath: "/ocr",
        gzip: false,
        cacheMethod: "none",
        workerBlobURL: false,
        logger: (message) => {
          if (scanEpoch !== epoch.current) return;
          const recognizing = message.status === "recognizing text";
          setStatus(recognizing ? "Reading prescription values…" : "Preparing the on-device scanner…");
          setProgress(recognizing ? Math.round(message.progress * 100) : 0);
        },
        errorHandler: () => { /* Do not log worker errors or document content. */ },
      });
      if (scanEpoch !== epoch.current) return;
      worker.current = scanWorker;
      await scanWorker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: "1", user_defined_dpi: "300" });
      const cropped = document.createElement("canvas");
      cropped.width = Math.max(1, Math.round(image.width * crop.width));
      cropped.height = Math.max(1, Math.round(image.height * crop.height));
      const context = cropped.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      context.drawImage(image, image.width * crop.left, image.height * crop.top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
      const recognized = await scanWorker.recognize(cropped);
      if (scanEpoch !== epoch.current) return;
      const parsed = parsePrescriptionScan(recognized.data.text);
      if (recognized.data.confidence < 70) parsed.warnings.unshift("The photo was difficult to read. Carefully check every value, especially plus/minus signs and axis.");
      setResult(parsed);
      setConfirmed(false);
      setIncludePd(true);
    } catch {
      if (scanEpoch === epoch.current) setError("The scan could not complete. Try a clearer, well-lit photo cropped to the prescription table, or enter the values manually.");
    } finally {
      window.clearTimeout(timeout);
      await scanWorker?.terminate();
      if (worker.current === scanWorker) worker.current = null;
      if (scanEpoch === epoch.current) setBusy(false);
    }
  }

  function updateEye(eye: "od" | "os", field: keyof ScannedEyeValues, value: string) {
    const number = value === "" ? null : Number(value);
    setResult((current) => current ? {
      ...current,
      [eye]: { ...current[eye], [field]: number, ...(field === "cylinder" && number === 0 ? { axis: null } : {}) },
    } : null);
    setConfirmed(false);
  }

  const reviewed = result ? reviewedScanPrescription(result) : null;
  const pd = result?.pupillaryDistance ?? null;
  const validPd = (value: string, min: number, max: number) => Boolean(value.trim()) && Number(value) >= min && Number(value) <= max;
  const pdComplete = !includePd || !pd || (pd.mode === "binocular" ? validPd(pd.binocular, 40, 85) : validPd(pd.right, 20, 45) && validPd(pd.left, 20, 45));

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-teal-200 bg-teal-50/60 p-3">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}><ScanLine className="h-4 w-4" />Scan printed Rx</Button>
        <p className="text-xs text-navy-500">Use your camera or a photo. Review before filling the fields.</p>
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-teal-200 bg-white p-4" aria-label="Printed prescription scanner">
      <div className="flex items-start justify-between gap-3">
        <div><h3 className="font-semibold text-navy-900">Scan printed prescription</h3><p className="mt-1 text-xs text-navy-500">Processed on this device. LensWise does not upload or save photos or text. Your camera app may keep a copy when you use Take a photo; crop out identifying details before scanning.</p></div>
        <Button variant="ghost" size="icon" onClick={close} aria-label="Close prescription scanner"><X className="h-4 w-4" /></Button>
      </div>
      <input ref={photoInput} type="file" accept="image/*" className="hidden" aria-label="Choose prescription photo" onChange={(event) => { void loadPhoto(event.target.files?.[0]); event.target.value = ""; }} />
      <input ref={captureInput} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Take prescription photo" onChange={(event) => { void loadPhoto(event.target.files?.[0]); event.target.value = ""; }} />
      {!result && !cameraOpen ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="accent" size="sm" onClick={() => void startCamera()} disabled={busy || cameraStarting}><Camera className="h-4 w-4" />{cameraStarting ? "Opening camera…" : "Use camera"}</Button>
          <Button variant="secondary" size="sm" onClick={() => captureInput.current?.click()} disabled={busy || cameraStarting}>Take a photo</Button>
          <Button variant="secondary" size="sm" onClick={() => photoInput.current?.click()} disabled={busy || cameraStarting}><Upload className="h-4 w-4" />Choose photo</Button>
        </div>
      ) : null}
      {cameraOpen ? (
        <div className="space-y-3">
          <p className="text-sm text-navy-600">Hold the page flat in good light. Fill the view with the prescription table, including the OD/OS labels.</p>
          <video ref={video} muted playsInline autoPlay className="max-h-[420px] w-full rounded-lg bg-navy-950" aria-label="Prescription camera preview" onClick={() => void video.current?.play()} />
          <div className="flex flex-wrap gap-2"><Button variant="accent" onClick={capturePhoto}><Camera className="h-4 w-4" />Capture prescription</Button><Button variant="secondary" onClick={stopCamera}>Cancel camera</Button></div>
        </div>
      ) : null}
      {image ? (
        <div className="space-y-2">
          {!result ? <p className="text-xs text-navy-500">Drag over the Rx table to crop. Keep the column headings and both eye labels inside the teal box.</p> : <p className="text-xs text-navy-500">Compare the values below with the original photo.</p>}
          <div className={`relative overflow-hidden rounded-lg border border-navy-200 ${!result && !busy ? "touch-none cursor-crosshair" : ""}`} onPointerDown={startCrop} onPointerMove={dragCrop} onPointerUp={finishCrop} onPointerCancel={finishCrop}>
            <canvas ref={previewCanvas} className="block h-auto w-full" role="img" aria-label="Local prescription photo for review" />
            {!result ? <div className="pointer-events-none absolute border-2 border-teal-600 bg-teal-500/5" style={{ left: `${crop.left * 100}%`, top: `${crop.top * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }} /> : null}
          </div>
          {!result && !busy ? <div className="flex flex-wrap gap-2"><Button variant="ghost" size="sm" onClick={rotatePhoto}><RotateCw className="h-4 w-4" />Rotate</Button><Button variant="ghost" size="sm" onClick={() => setCrop(FULL_CROP)}>Reset crop</Button><Button variant="accent" size="sm" onClick={() => void scanPhoto()}><ScanLine className="h-4 w-4" />Read prescription</Button></div> : null}
        </div>
      ) : null}
      {busy ? <div className="space-y-2" role="status" aria-live="polite"><p className="flex items-center gap-2 text-sm text-teal-700"><Loader2 className="h-4 w-4 animate-spin" />{status}{progress > 0 ? ` ${progress}%` : ""}</p><div className="h-2 overflow-hidden rounded-full bg-teal-50"><div className="h-full bg-teal-600" style={{ width: `${Math.max(progress, 5)}%` }} /></div><Button size="sm" variant="ghost" onClick={cancelScan}>Cancel scan</Button></div> : null}
      {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
      {result ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><p className="font-semibold">Check every value against the paper, including signs, ADD, and axis.</p>{result.warnings.length ? <ul className="mt-2 list-disc space-y-1 pl-4">{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul> : null}</div>
          <div className="grid gap-3 sm:grid-cols-2">{(["od", "os"] as const).map((eye) => <ReviewEye key={eye} eye={eye} values={result[eye]} onChange={(field, value) => updateEye(eye, field, value)} />)}</div>
          {pd ? <div className="rounded-lg border border-navy-100 p-3"><label className="flex items-center gap-2 text-sm font-medium text-navy-700"><input type="checkbox" checked={includePd} onChange={(event) => { setIncludePd(event.target.checked); setConfirmed(false); }} className="h-4 w-4 accent-teal-600" />Also fill the printed PD (mm)</label>{includePd ? <div className="mt-3 flex flex-wrap gap-3">{(pd.mode === "binocular" ? ["binocular"] : ["right", "left"]).map((field) => <div key={field} className="w-28"><Label htmlFor={`scan-pd-${field}`} className="text-xs">{field === "binocular" ? "Total PD" : field === "right" ? "OD / Right" : "OS / Left"}</Label><Input id={`scan-pd-${field}`} inputMode="decimal" maxLength={4} value={pd[field as "binocular" | "right" | "left"]} onChange={(event) => { const value = sanitizePupillaryDistanceValue(event.target.value); setResult((current) => current?.pupillaryDistance ? { ...current, pupillaryDistance: { ...current.pupillaryDistance, [field]: value } } : current); setConfirmed(false); }} /></div>)}</div> : null}</div> : null}
          <label className="flex items-start gap-2 text-sm text-navy-700"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-teal-600" />I checked both eyes, signs, axis, ADD, and any PD against the original prescription.</label>
          {!reviewed ? <p className="text-xs text-red-700">Choose sphere and cylinder for both eyes, plus axis whenever cylinder is not zero.</p> : null}
          {!pdComplete ? <p className="text-xs text-red-700">Check PD: total must be 40–85 mm, or 20–45 mm for each eye. Uncheck the PD option to enter it separately.</p> : null}
          <div className="flex flex-wrap gap-2"><Button variant="accent" disabled={!confirmed || !reviewed || !pdComplete} onClick={() => { if (!confirmed || !reviewed || !pdComplete) return; onReviewed({ prescription: reviewed, pupillaryDistance: includePd ? pd : null }); close(); }}><Check className="h-4 w-4" />Fill prescription fields</Button><Button variant="secondary" onClick={() => { setResult(null); setConfirmed(false); }}>Scan again</Button><Button variant="ghost" onClick={close}>Discard</Button></div>
          <p className="text-xs text-navy-500">The filled prescription remains a draft until you press Apply Prescription.</p>
        </div>
      ) : null}
    </section>
  );
}

function ReviewEye({ eye, values, onChange }: { eye: "od" | "os"; values: ScannedEyeValues; onChange: (field: keyof ScannedEyeValues, value: string) => void }) {
  const fields = [
    { field: "sphere" as const, label: "Sphere", options: SPHERE_OPTIONS },
    { field: "cylinder" as const, label: "Cylinder", options: CYLINDER_OPTIONS },
    { field: "axis" as const, label: "Axis", options: AXIS_OPTIONS },
    { field: "add" as const, label: "ADD", options: ADD_OPTIONS },
  ];
  return <div className="rounded-lg border border-navy-100 p-3"><p className="mb-2 text-sm font-semibold text-navy-800">{eye === "od" ? "OD / Right eye" : "OS / Left eye"}</p><div className="grid grid-cols-2 gap-2">{fields.map(({ field, label, options }) => <div key={field}><Label htmlFor={`scan-${eye}-${field}`} className="text-xs">{label}</Label><Select id={`scan-${eye}-${field}`} value={values[field] === null ? "" : String(values[field])} disabled={field === "axis" && values.cylinder === 0} aria-label={`Scanned ${eye.toUpperCase()} ${label}`} onChange={(event) => onChange(field, event.target.value)}><option value="">{field === "add" ? "None / not found" : field === "axis" && values.cylinder === 0 ? "—" : "Check / select"}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></div>)}</div></div>;
}
