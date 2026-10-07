"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { Camera, Check, RotateCcw, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { estimateCameraPd, type PhotoPoint } from "@/lib/cameraPd";
import { sanitizePupillaryDistanceValue } from "@/lib/pupillaryDistance";

const markLabels = ["Reference left end", "Reference right end", "Pupil on image left", "Pupil on image right"];

/** Images and video remain in this component's memory only. Only the verified
 * total PD is returned; no upload, browser storage, or inferred monocular PD. */
export function CameraPdMeasurement({ onApply }: { onApply: (binocular: string) => void }) {
  const [open, setOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [marks, setMarks] = useState<(PhotoPoint | null)[]>([null, null, null, null]);
  const [activeMark, setActiveMark] = useState(0);
  const [referenceMm, setReferenceMm] = useState("50");
  const [zoom, setZoom] = useState(1);
  const [reviewedPd, setReviewedPd] = useState("");
  const [verified, setVerified] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const photoUrlRef = useRef<string | null>(null);
  const operationRef = useRef(0);
  const imageOperationRef = useRef(0);
  const uploadRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }

  function clearPhoto() {
    imageOperationRef.current += 1;
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    photoUrlRef.current = null;
    setPhoto(null);
    setImageSize({ width: 0, height: 0 });
    setMarks([null, null, null, null]);
    setActiveMark(0);
    setZoom(1);
    setReviewedPd("");
    setVerified(false);
  }

  function close() {
    operationRef.current += 1;
    stopCamera();
    clearPhoto();
    setBusy(false);
    setError("");
    setOpen(false);
  }

  useEffect(() => {
    if (open && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
    if (!open && dialogRef.current?.open) dialogRef.current.close();
  }, [open]);

  useEffect(() => () => {
    operationRef.current += 1;
    imageOperationRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
  }, []);

  const result = useMemo(() => {
    const [referenceStart, referenceEnd, pupilStart, pupilEnd] = marks;
    if (!referenceStart || !referenceEnd || !pupilStart || !pupilEnd) return null;
    return estimateCameraPd({ referenceStart, referenceEnd, pupilStart, pupilEnd }, imageSize, Number(referenceMm));
  }, [marks, imageSize, referenceMm]);

  useEffect(() => {
    setReviewedPd(result?.ok ? String(result.binocularMm) : "");
    setVerified(false);
  }, [result]);

  async function startCamera() {
    stopCamera();
    clearPhoto();
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Live camera needs HTTPS or localhost. Use Take photo or Choose photo instead.");
      return;
    }
    const operation = ++operationRef.current;
    setBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (operation !== operationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (!videoRef.current) throw new Error("Camera preview is unavailable.");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      if (operation !== operationRef.current) return;
      setCameraActive(true);
    } catch (cause) {
      if (operation !== operationRef.current) return;
      stopCamera();
      const name = cause instanceof DOMException ? cause.name : "";
      setError(name === "NotAllowedError"
        ? "Camera permission was denied. Allow camera access in your browser or choose a photo."
        : "The camera could not start. Try Take photo or Choose photo.");
    } finally {
      if (operation === operationRef.current) setBusy(false);
    }
  }

  function loadPhoto(file: Blob) {
    stopCamera();
    clearPhoto();
    setError("");
    if (file.size > 12 * 1024 * 1024) {
      setError("Choose a photo smaller than 12 MB.");
      return;
    }
    const imageOperation = imageOperationRef.current;
    const url = URL.createObjectURL(file);
    photoUrlRef.current = url;
    const image = new window.Image();
    image.onload = () => {
      if (imageOperation !== imageOperationRef.current) return;
      setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
      setPhoto(url);
    };
    image.onerror = () => {
      if (imageOperation !== imageOperationRef.current) return;
      clearPhoto();
      setError("This image could not be opened. Try a JPEG, PNG, or WebP photo.");
    };
    image.src = url;
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const operation = operationRef.current;
    canvas.toBlob((blob) => {
      if (operation !== operationRef.current) return;
      if (blob) loadPhoto(blob);
      else setError("The camera photo could not be captured. Try again.");
      canvas.width = 0;
      canvas.height = 0;
    }, "image/jpeg", 0.95);
  }

  function placeMark(point: PhotoPoint) {
    setMarks((current) => current.map((mark, index) => index === activeMark ? point : mark));
    setActiveMark((current) => Math.min(current + 1, 3));
  }

  function clickPhoto(event: MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    placeMark({ x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height });
  }

  function refineMark(event: KeyboardEvent<HTMLDivElement>) {
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    };
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      placeMark(marks[activeMark] ?? { x: 0.5, y: 0.5 });
    } else if (directions[event.key]) {
      event.preventDefault();
      const [dx, dy] = directions[event.key];
      const current = marks[activeMark] ?? { x: 0.5, y: 0.5 };
      const increment = event.shiftKey ? 10 : 1;
      setMarks((existing) => existing.map((mark, index) => index === activeMark ? {
        x: Math.max(0, Math.min(1, current.x + dx * increment / imageSize.width)),
        y: Math.max(0, Math.min(1, current.y + dy * increment / imageSize.height)),
      } : mark));
    }
  }

  const canApply = result?.ok && verified && Number(reviewedPd) >= 35 && Number(reviewedPd) <= 85;

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Camera className="h-4 w-4" aria-hidden="true" /> Camera PD estimate
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby="camera-pd-title"
        onCancel={(event) => { event.preventDefault(); close(); }}
        className="no-print m-auto max-h-[92dvh] w-[calc(100%_-_1.5rem)] max-w-3xl overflow-y-auto rounded-3xl border border-navy-200 bg-paper p-0 text-navy-900 shadow-xl backdrop:bg-navy-950/60"
      >
        {open ? <div className="space-y-4 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="camera-pd-title" className="text-xl font-semibold">Camera PD estimate</h2>
              <p className="mt-1 text-sm text-navy-600">A known-size reference and four marks are required.</p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Close camera PD" onClick={close}><X className="h-5 w-5" /></Button>
          </div>
          <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm leading-6">
            Use a ruler with a measured 50 mm span, or a blank standard card (85.6 mm wide).
            Hold it level beside the eyes, as close as possible to the same depth as the pupils.
            Keep the face straight and centered, remove glasses, and use even lighting.
            Ask the patient to look at a distant target, not the phone.
          </div>
          <p className="text-xs text-navy-500">Photos stay in this session and are discarded when this window closes. Obtain the patient’s agreement before taking a photo; use a blank reference with no personal information.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="accent" size="sm" disabled={busy} onClick={startCamera}><Camera className="h-4 w-4" /> {busy ? "Starting camera…" : "Start live camera"}</Button>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => captureRef.current?.click()}>Take photo</Button>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => uploadRef.current?.click()}><Upload className="h-4 w-4" /> Choose photo</Button>
            <input ref={captureRef} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Take a PD reference photo" onChange={(event) => { const file = event.target.files?.[0]; if (file) loadPhoto(file); event.target.value = ""; }} />
            <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Choose a PD reference photo" onChange={(event) => { const file = event.target.files?.[0]; if (file) loadPhoto(file); event.target.value = ""; }} />
          </div>
          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          <video ref={videoRef} playsInline muted className={`w-full rounded-xl bg-navy-950 ${cameraActive || busy ? "block" : "hidden"}`} />
          {cameraActive ? <div className="flex gap-2"><Button variant="accent" onClick={capturePhoto}>Capture reference photo</Button><Button variant="secondary" onClick={stopCamera}>Stop camera</Button></div> : null}
          {photo ? <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="max-w-48">
                <Label htmlFor="camera-pd-reference">Reference span (mm)</Label>
                <Input id="camera-pd-reference" type="number" inputMode="decimal" min={20} max={100} step="0.1" value={referenceMm} onChange={(event) => setReferenceMm(event.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => setReferenceMm("50")}>50 mm ruler</Button>
                <Button variant="secondary" size="sm" onClick={() => setReferenceMm("85.6")}>85.6 mm card</Button>
                <Button variant="ghost" size="sm" onClick={() => { setMarks([null, null, null, null]); setActiveMark(0); }}><RotateCcw className="h-4 w-4" /> Reset marks</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Photo marks">
              {markLabels.map((label, index) => <Button key={label} size="sm" variant={index === activeMark ? "accent" : "secondary"} className="h-auto min-h-10 whitespace-normal px-2 py-2 text-xs" aria-pressed={index === activeMark} onClick={() => setActiveMark(index)}>{marks[index] ? <Check className="h-3 w-3 shrink-0" /> : <span>{index + 1}.</span>}{label}</Button>)}
            </div>
            <p className="text-sm font-medium" aria-live="polite">Tap {markLabels[activeMark].toLowerCase()} in the photo. Select a mark above to reposition it.</p>
            <div className="flex items-center gap-2 text-xs text-navy-500">Zoom:{[1, 2, 3].map((value) => <Button key={value} size="sm" variant={zoom === value ? "accent" : "ghost"} className="h-8 px-3" aria-pressed={zoom === value} onClick={() => setZoom(value)}>{value}×</Button>)}</div>
            <div className="max-h-[55vh] overflow-auto rounded-xl border border-navy-200 bg-white">
              <div role="button" tabIndex={0} aria-label={`Place ${markLabels[activeMark]}. Use arrow keys to refine; Enter advances to the next mark.`} onClick={clickPhoto} onKeyDown={refineMark} className="relative cursor-crosshair outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600" style={{ width: `${zoom * 100}%` }}>
                {/* This image is a private in-memory object URL, not a remote asset. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="PD reference photo for marking pupil centers and reference endpoints" className="block h-auto w-full select-none" draggable={false} />
                <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}>
                  {[0, 2].map((index) => marks[index] && marks[index + 1] ? <line key={index} x1={marks[index]!.x * imageSize.width} y1={marks[index]!.y * imageSize.height} x2={marks[index + 1]!.x * imageSize.width} y2={marks[index + 1]!.y * imageSize.height} stroke={index === 0 ? "#ff9c7c" : "#0d7c82"} strokeWidth={2} vectorEffect="non-scaling-stroke" /> : null)}
                  {marks.map((mark, index) => mark ? <g key={index} transform={`translate(${mark.x * imageSize.width} ${mark.y * imageSize.height})`}>
                    <circle r={imageSize.width / 65} fill="none" stroke="white" strokeWidth={4} vectorEffect="non-scaling-stroke" />
                    <circle r={imageSize.width / 65} fill="none" stroke={index < 2 ? "#e56c43" : "#0d7c82"} strokeWidth={2} vectorEffect="non-scaling-stroke" />
                    <line x1={-imageSize.width / 100} x2={imageSize.width / 100} stroke="white" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                    <line y1={-imageSize.width / 100} y2={imageSize.width / 100} stroke="white" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                    <text x={imageSize.width / 45} y={-imageSize.width / 65} fontSize={imageSize.width / 40} fontWeight="bold" fill="white" stroke="#10243e" strokeWidth={imageSize.width / 700} paintOrder="stroke">{index + 1}</text>
                  </g> : null)}
                </svg>
              </div>
            </div>
            <p className="text-xs text-navy-500">At 2× or 3×, scroll to the next mark. Keyboard: arrow keys move one pixel, Shift + arrow moves ten.</p>
            {result ? result.ok ? <div className="space-y-3 rounded-xl border border-navy-200 bg-white p-4">
              <p className="text-lg font-semibold">Estimated total PD: {result.binocularMm.toFixed(1)} mm</p>
              <p className="text-sm text-navy-600">Photo angle, reference depth, pupil marks, and camera distortion can change this estimate. Check it with an optical ruler or pupilometer before using it. This does not measure monocular PD or fitting heights.</p>
              <div className="max-w-48"><Label htmlFor="camera-pd-reviewed">Verified total PD (mm)</Label><Input id="camera-pd-reviewed" inputMode="decimal" value={reviewedPd} maxLength={4} onChange={(event) => { setReviewedPd(sanitizePupillaryDistanceValue(event.target.value)); setVerified(false); }} /></div>
              <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} className="mt-1 h-4 w-4 accent-teal-600" /><span>I verified this total PD with an optical ruler or pupilometer.</span></label>
              <Button variant="accent" disabled={!canApply} onClick={() => { if (!canApply) return; onApply(reviewedPd); close(); }}>Use verified total PD</Button>
            </div> : <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{result.message}</p> : null}
          </> : null}
        </div> : null}
      </dialog>
    </>
  );
}
