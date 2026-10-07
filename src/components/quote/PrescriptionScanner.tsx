"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Camera, Check, Crop as CropIcon, Loader2, RotateCw, ScanLine, Upload, X } from "lucide-react";
import type { Worker } from "tesseract.js";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ADD_OPTIONS, AXIS_OPTIONS, CYLINDER_OPTIONS, SPHERE_OPTIONS } from "@/lib/prescriptionOptions";
import {
  parsePrescriptionScan,
  combinePrescriptionScanPasses,
  findPrescriptionScanRegions,
  reviewedScanPrescription,
  type PrescriptionScanResult,
  type ReviewedPrescriptionScan,
  type ScannedEyeValues,
  type PrescriptionScanWord,
  type PrescriptionScanRegion,
} from "@/lib/prescriptionScan";
import { sanitizePupillaryDistanceValue } from "@/lib/pupillaryDistance";
import { cleanPrescriptionCellPixels, findPrescriptionCellInkBounds, normalizePrescriptionCellPixels, preparePrescriptionScanImages, type PreparedPrescriptionScanImages } from "@/lib/prescriptionScanImage";
import { replacePrescriptionCellWords } from "@/lib/prescriptionScanRetry";
import { prescriptionScanDiagnostics, type PrescriptionScanDiagnostics } from "@/lib/prescriptionScanDiagnostics";
import { findPrescriptionGrids } from "@/lib/prescriptionScanGrid";
import { readPrescriptionTableGrids } from "@/lib/prescriptionScanTable";
import { mapPrescriptionTableCellWords, preparePrescriptionTableCell } from "@/lib/prescriptionScanTableImage";

interface Crop { left: number; top: number; width: number; height: number }
const FULL_CROP: Crop = { left: 0, top: 0, width: 1, height: 1 };

function eyeNeedsReading(eye: ScannedEyeValues) {
  return eye.sphere === null || eye.cylinder === null || (eye.cylinder !== 0 && eye.axis === null);
}

/** Keep printed headings and an observed eye label together for a focused retry. */
function focusedEyeCanvas(source: HTMLCanvasElement, header: PrescriptionScanRegion, row: PrescriptionScanRegion): HTMLCanvasElement {
  const left = Math.max(0, Math.floor(Math.min(header.left, row.left) - 8));
  const right = Math.min(source.width, Math.ceil(Math.max(header.left + header.width, row.left + row.width) + 8));
  const areas = [header, row].map((area, index) => {
    const padding = index === 0 ? 4 : 0;
    const top = Math.max(0, Math.floor(area.top - padding));
    const bottom = Math.min(source.height, Math.ceil(area.top + area.height + padding));
    return { top, height: Math.max(1, bottom - top) };
  });
  const canvas = document.createElement("canvas");
  canvas.width = right - left + 24;
  canvas.height = areas.reduce((sum, area) => sum + area.height, 0) + 36;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Local prescription crop unavailable");
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  let y = 12;
  for (const area of areas) {
    context.drawImage(source, left, area.top, right - left, area.height, 12, y, right - left, area.height);
    y += area.height + 12;
  }
  return canvas;
}

function focusedCellCanvas(source: HTMLCanvasElement, area: PrescriptionScanRegion) {
  const left = Math.max(0, Math.floor(area.left));
  const top = Math.max(0, Math.floor(area.top));
  const width = Math.min(source.width - left, Math.ceil(area.left + area.width) - left);
  const height = Math.min(source.height - top, Math.ceil(area.top + area.height) - top);
  const padding = 12;
  const canvas = document.createElement("canvas");
  canvas.width = width + padding * 2;
  canvas.height = height + padding * 2;
  const context = canvas.getContext("2d");
  if (!context || width <= 0 || height <= 0) throw new Error("Local prescription cell unavailable");
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, left, top, width, height, padding, padding, width, height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  pixels.data.set(cleanPrescriptionCellPixels(pixels.data, canvas.width, canvas.height, { padding }));
  context.putImageData(pixels, 0, 0);
  return { canvas, left, top, padding };
}

/** A second cell reading excludes paper shadows without changing characters. */
function focusedInkCellCanvas(source: HTMLCanvasElement, area: PrescriptionScanRegion) {
  const sourceContext = source.getContext("2d");
  if (!sourceContext) return null;
  const left = Math.max(0, Math.floor(area.left));
  const top = Math.max(0, Math.floor(area.top));
  const width = Math.min(source.width - left, Math.ceil(area.left + area.width) - left);
  const height = Math.min(source.height - top, Math.ceil(area.top + area.height) - top);
  if (width <= 0 || height <= 0) return null;
  const pixels = sourceContext.getImageData(left, top, width, height);
  const bounds = findPrescriptionCellInkBounds(pixels.data, width, height);
  if (!bounds) return null;
  const tight = document.createElement("canvas");
  const canvas = document.createElement("canvas");
  try {
    const padding = 12;
    tight.width = bounds.width + padding * 2;
    tight.height = bounds.height + padding * 2;
    const tightContext = tight.getContext("2d");
    const context = canvas.getContext("2d");
    if (!tightContext || !context) throw new Error("Local prescription cell preparation unavailable");
    const ink = sourceContext.getImageData(left + bounds.left, top + bounds.top, bounds.width, bounds.height);
    tightContext.fillStyle = "white";
    tightContext.fillRect(0, 0, tight.width, tight.height);
    tightContext.putImageData(ink, padding, padding);
    const paddedInk = tightContext.getImageData(0, 0, tight.width, tight.height);
    paddedInk.data.set(normalizePrescriptionCellPixels(paddedInk.data, tight.width, tight.height, { sharpen: false }));
    tightContext.putImageData(paddedInk, 0, 0);
    // Preserve the actual rounded aspect ratio. Add the white border AFTER
    // resizing so OCR does not mistake a scaled table rule for a minus sign.
    const resizedWidth = Math.max(1, Math.round(tight.width * 0.85));
    const resizedHeight = Math.max(1, Math.round(tight.height * resizedWidth / tight.width));
    canvas.width = resizedWidth + padding * 2;
    canvas.height = resizedHeight + padding * 2;
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(tight, padding, padding, resizedWidth, resizedHeight);
    const scaleX = resizedWidth / tight.width;
    const scaleY = resizedHeight / tight.height;
    return {
      canvas, scaleX, scaleY,
      left: left + bounds.left - padding - padding / scaleX,
      top: top + bounds.top - padding - padding / scaleY,
    };
  } catch (error) {
    canvas.width = canvas.height = 0;
    throw error;
  } finally {
    tight.width = tight.height = 0;
  }
}

function canvasFromImage(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const scale = Math.min(1, 4800 / Math.max(width, height), Math.sqrt(8_000_000 / (width * height)));
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
  const [cropMode, setCropMode] = useState(false);
  const [scannedCrop, setScannedCrop] = useState<Crop | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<PrescriptionScanResult | null>(null);
  const [scanDetails, setScanDetails] = useState<PrescriptionScanDiagnostics[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [includePd, setIncludePd] = useState(true);
  const photoInput = useRef<HTMLInputElement>(null);
  const captureInput = useRef<HTMLInputElement>(null);
  const previewCanvas = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const worker = useRef<Worker | null>(null);
  const scanCleanup = useRef<(() => void) | null>(null);
  const scanAbort = useRef<(() => void) | null>(null);
  const epoch = useRef(0);
  const cropStart = useRef<{ pointerId: number; x: number; y: number; previous: Crop; next: Crop | null } | null>(null);

  function stopCamera() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setCameraOpen(false);
    setCameraStarting(false);
  }

  function cancelScan() {
    epoch.current += 1;
    scanAbort.current?.();
    scanCleanup.current?.();
    void worker.current?.terminate();
    worker.current = null;
    setBusy(false);
    setScanDetails([]);
  }

  function close() {
    cancelScan();
    stopCamera();
    setImage(null);
    cropStart.current = null;
    setCropMode(false);
    setScannedCrop(null);
    setResult(null);
    setError("");
    setConfirmed(false);
    setOpen(false);
  }

  useEffect(() => () => {
    epoch.current += 1;
    scanAbort.current?.();
    scanCleanup.current?.();
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
    cropStart.current = null;
    setImage(canvas);
    setCrop(FULL_CROP);
    setCropMode(false);
    setScannedCrop(null);
    setResult(null);
    setScanDetails([]);
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
      if (photoEpoch === epoch.current) setError("This photo could not be opened. Try a JPG or take a new photo with the camera.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function startCamera() {
    setError("");
    setScanDetails([]);
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
      if (cameraEpoch === epoch.current) setError("Camera access was denied or no camera is available. Allow camera access or use Take a photo / Choose photo.");
    } finally {
      if (cameraEpoch === epoch.current) setCameraStarting(false);
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
    cropStart.current = null;
    setImage(rotated);
    setCrop(FULL_CROP);
    setCropMode(false);
    setScannedCrop(null);
    setScanDetails([]);
  }

  function pointerPosition(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    };
  }

  function startCrop(event: PointerEvent<HTMLDivElement>) {
    if (!cropMode || busy || result || cropStart.current || !event.isPrimary || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    cropStart.current = { ...pointerPosition(event), pointerId: event.pointerId, previous: crop, next: null };
  }

  function dragCrop(event: PointerEvent<HTMLDivElement>) {
    if (!cropMode || !cropStart.current || cropStart.current.pointerId !== event.pointerId || busy || result) return;
    const end = pointerPosition(event);
    const start = cropStart.current;
    start.next = { left: Math.min(start.x, end.x), top: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
    setCrop(start.next);
  }

  function finishCrop(event: PointerEvent<HTMLDivElement>) {
    const gesture = cropStart.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    cropStart.current = null;
    setCrop(gesture.next && gesture.next.width >= 0.03 && gesture.next.height >= 0.03 ? gesture.next : gesture.previous);
  }

  function cancelCrop(event: PointerEvent<HTMLDivElement>) {
    const gesture = cropStart.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    cropStart.current = null;
    setCrop(gesture.previous);
  }

  function doneCropping() {
    if (cropStart.current) setCrop(cropStart.current.previous);
    cropStart.current = null;
    setCropMode(false);
  }

  function resetCrop() {
    cropStart.current = null;
    setCrop(FULL_CROP);
    setCropMode(false);
    setScanDetails([]);
  }

  async function scanPhoto() {
    if (!image || cropMode || cropStart.current) return;
    setScannedCrop({ ...crop });
    setScanDetails([]);
    setBusy(true);
    setError("");
    setProgress(0);
    setStatus("Loading the on-device scanner…");
    const scanEpoch = ++epoch.current;
    let scanWorker: Worker | null = null;
    const preparedImages: PreparedPrescriptionScanImages[] = [];
    const focusedCanvases: HTMLCanvasElement[] = [];
    const cleanup = () => {
      preparedImages.forEach((prepared) => prepared.dispose());
      focusedCanvases.forEach((canvas) => { canvas.width = 0; canvas.height = 0; });
    };
    scanCleanup.current = cleanup;
    let abort = () => {};
    const cancelled = new Promise<never>((_, reject) => {
      abort = () => reject(new Error("Local prescription scan cancelled"));
    });
    scanAbort.current = abort;
    const untilCancelled = <T,>(operation: Promise<T>) => Promise.race([operation, cancelled]);
    let readingStatus = "Reading prescription values…";
    const timeout = window.setTimeout(() => {
      if (scanEpoch !== epoch.current) return;
      cancelScan();
      setError("The scan took too long. Crop closely around the prescription table and try again.");
    }, 90000);
    try {
      const { createWorker, OEM, PSM } = await untilCancelled(import("tesseract.js"));
      if (scanEpoch !== epoch.current) return;
      const startingWorker = createWorker("eng", OEM.LSTM_ONLY, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr/core",
        langPath: "/ocr",
        gzip: false,
        cacheMethod: "none",
        workerBlobURL: false,
        logger: (message) => {
          if (scanEpoch !== epoch.current) return;
          const recognizing = message.status === "recognizing text";
          setStatus(recognizing ? readingStatus : "Preparing the on-device scanner…");
          setProgress(recognizing ? Math.round(message.progress * 100) : 0);
        },
        errorHandler: () => { /* Do not log worker errors or document content. */ },
      }, { load_system_dawg: "0", load_freq_dawg: "0" });
      // Cancellation during model startup must also terminate a late worker.
      void startingWorker.then((created) => {
        if (scanEpoch !== epoch.current) void created.terminate();
      }, () => {});
      scanWorker = await untilCancelled(startingWorker);
      if (scanEpoch !== epoch.current) return;
      worker.current = scanWorker;
      await untilCancelled(scanWorker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: "1", user_defined_dpi: "300" }));
      const prepared = preparePrescriptionScanImages(image, crop);
      preparedImages.push(prepared);
      const recognized = await untilCancelled(scanWorker.recognize(prepared.grayscale, {}, { text: true, blocks: true }));
      if (scanEpoch !== epoch.current) return;
      const wordsFromBlocks = (blocks: typeof recognized.data.blocks): PrescriptionScanWord[] =>
        (blocks ?? []).flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines.flatMap((line) => line.words)));
      const firstWords = wordsFromBlocks(recognized.data.blocks);
      let regions = findPrescriptionScanRegions(firstWords);
      let regionSource = prepared.grayscale;
      let regionWords = firstWords;
      let parsed = parsePrescriptionScan(recognized.data.text, firstWords);
      let confidence = recognized.data.confidence;
      const fullCrop = crop.left === 0 && crop.top === 0 && crop.width === 1 && crop.height === 1;
      setScanDetails([prescriptionScanDiagnostics({
        pass: "initial", sourceWidth: image.width, sourceHeight: image.height,
        ocrWidth: prepared.grayscale.width, ocrHeight: prepared.grayscale.height,
        fullCrop, words: firstWords, result: parsed,
      })]);
      // Table borders and unrelated text can lower document confidence even
      // when every optical cell passed its own checks. Recheck missing values;
      // a complete reading goes straight to the mandatory manual review.
      if (!parsed.requiresRescan && !parsed.requiresAlignment && !reviewedScanPrescription(parsed)) {
        readingStatus = "Enhancing faint text and checking both eye rows…";
        setProgress(0);
        setStatus(readingStatus);
        // Remove surrounding sections and enlarge small printed characters
        // before the alternate reading; never manufacture a missing eye label.
        const area = regions?.table;
        const heights = firstWords.filter((word) => !area || word.bbox.y0 >= area.top && word.bbox.y1 <= area.top + area.height)
          .map((word) => word.bbox.y1 - word.bbox.y0).sort((a, b) => a - b);
        const retryImages = area ? preparePrescriptionScanImages(prepared.grayscale, {
          left: area.left / prepared.grayscale.width,
          top: area.top / prepared.grayscale.height,
          width: Math.min(area.width, prepared.grayscale.width - area.left) / prepared.grayscale.width,
          height: Math.min(area.height, prepared.grayscale.height - area.top) / prepared.grayscale.height,
        }, { estimatedWordHeight: heights[Math.floor(heights.length / 2)] }) : prepared;
        if (retryImages !== prepared) preparedImages.push(retryImages);
        await untilCancelled(scanWorker.setParameters({ tessedit_pageseg_mode: area ? PSM.AUTO : PSM.SPARSE_TEXT }));
        const retry = await untilCancelled(scanWorker.recognize(retryImages.getEnhanced(), {}, { text: true, blocks: true }));
        if (scanEpoch !== epoch.current) return;
        const retryWords = wordsFromBlocks(retry.data.blocks);
        const retryParsed = parsePrescriptionScan(retry.data.text, retryWords);
        const retryDetails = prescriptionScanDiagnostics({
          pass: "enhanced", sourceWidth: image.width, sourceHeight: image.height,
          ocrWidth: retryImages.getEnhanced().width, ocrHeight: retryImages.getEnhanced().height,
          fullCrop: fullCrop && !area, words: retryWords, result: retryParsed,
        });
        setScanDetails((current) => [...current, retryDetails]);
        parsed = combinePrescriptionScanPasses(parsed, retryParsed);
        // Coordinates must always be used with the image they came from.
        const retryRegions = findPrescriptionScanRegions(retryWords);
        if (retryRegions) { regions = retryRegions; regionSource = retryImages.grayscale; regionWords = retryWords; }
        confidence = Math.min(confidence, retry.data.confidence);
      }
      if (!parsed.requiresRescan && !parsed.requiresAlignment && !reviewedScanPrescription(parsed)) {
        readingStatus = "Finding the printed table and reading its cells…";
        setStatus(readingStatus);
        setProgress(0);
        // Detect actual printed rules independently of merged OCR headings.
        // The geometry mask never becomes OCR input; only original grayscale
        // cell pixels are read. The reader must recognize headings and eyes.
        const context = prepared.grayscale.getContext("2d");
        if (context) {
          const sourceWidth = prepared.grayscale.width, sourceHeight = prepared.grayscale.height;
          // Do not retain the full-page pixel buffer across the async cell reads.
          const grids = findPrescriptionGrids(context.getImageData(0, 0, sourceWidth, sourceHeight).data, sourceWidth, sourceHeight);
          await untilCancelled(scanWorker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: "" }));
          const tableReading = await readPrescriptionTableGrids(grids, sourceWidth, sourceHeight, async (area, kind) => {
            if (scanEpoch !== epoch.current) return [];
            readingStatus = kind === "heading" ? "Identifying the printed column headings…"
              : kind === "eye" ? "Checking the printed OD and OS labels…" : "Reading individual prescription cells…";
            setStatus(readingStatus);
            setProgress(0);
            const cell = preparePrescriptionTableCell(prepared.grayscale, area);
            focusedCanvases.push(cell.canvas);
            try {
              const reading = await untilCancelled(scanWorker!.recognize(cell.canvas, {}, { text: true, blocks: true }));
              if (scanEpoch !== epoch.current) return [];
              return mapPrescriptionTableCellWords(wordsFromBlocks(reading.data.blocks), cell.plan);
            } finally {
              cell.dispose();
            }
          }, () => scanEpoch !== epoch.current);
          if (scanEpoch !== epoch.current || tableReading.metadata.cancelled) return;
          const tableDetails = prescriptionScanDiagnostics({
            pass: "table", sourceWidth: image.width, sourceHeight: image.height,
            ocrWidth: sourceWidth, ocrHeight: sourceHeight, fullCrop,
            words: tableReading.words, result: tableReading.result ?? parsePrescriptionScan(""),
            tableReading: { gridsDetected: grids.length, ...tableReading.metadata },
          });
          setScanDetails((current) => [...current, tableDetails]);
          // Never replace previous evidence: conflicts and ambiguity remain
          // blank even if a cell retry looks cleaner.
          if (tableReading.result) parsed = combinePrescriptionScanPasses(parsed, tableReading.result);
        }
      }
      if (!parsed.requiresRescan && !parsed.requiresAlignment && regions) {
        for (const eye of ["od", "os"] as const) {
          const row = regions.rows[eye];
          if (!row || !eyeNeedsReading(parsed[eye])) continue;
          readingStatus = `Checking the ${eye === "od" ? "right (OD)" : "left (OS)"} eye row more closely…`;
          setStatus(readingStatus);
          setProgress(0);
          const focused = focusedEyeCanvas(regionSource, regions.header, row);
          focusedCanvases.push(focused);
          const heights = regionWords.filter((word) => word.bbox.y0 >= row.top && word.bbox.y1 <= row.top + row.height)
            .map((word) => word.bbox.y1 - word.bbox.y0).sort((a, b) => a - b);
          const focusedImages = preparePrescriptionScanImages(focused, FULL_CROP, { estimatedWordHeight: heights[Math.floor(heights.length / 2)] });
          preparedImages.push(focusedImages);
          await untilCancelled(scanWorker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK }));
          const retry = await untilCancelled(scanWorker.recognize(focusedImages.getEnhanced(), {}, { text: true, blocks: true }));
          if (scanEpoch !== epoch.current) return;
          const focusedResult = parsePrescriptionScan(retry.data.text, wordsFromBlocks(retry.data.blocks));
          const otherEye = eye === "od" ? "os" : "od";
          // A cropped OD row can never supply OS (or vice versa), even if a
          // later OCR pass misreads the printed label as the opposite eye.
          if (Object.values(focusedResult[otherEye]).some((value) => value !== null)) {
            parsed.warnings.push(`${eye.toUpperCase()}: the focused reading could not confirm the eye label. Check this row manually.`);
          } else {
            focusedResult.pupillaryDistance = null;
            focusedResult.warnings = focusedResult.warnings.filter((warning) => !warning.startsWith(`${otherEye.toUpperCase()}:`));
            parsed = combinePrescriptionScanPasses(parsed, focusedResult);
          }
          confidence = Math.min(confidence, retry.data.confidence);
          focusedImages.dispose();
          focused.width = 0;
          focused.height = 0;
          if (parsed.requiresRescan) break;
        }
      }
      if (!parsed.requiresRescan && !parsed.requiresAlignment && regions && !reviewedScanPrescription(parsed)) {
        // Cell retries retain the original observed table headings/eye labels.
        // OCR recognizes the printed characters; there is no digit substitution
        // or assumption that an unlabelled second row belongs to the left eye.
        let cellWords = [...regionWords];
        for (const eye of ["od", "os"] as const) {
          for (const field of ["sphere", "cylinder", "axis"] as const) {
            if (parsed.requiresRescan || parsed[eye][field] !== null || (field === "axis" && parsed[eye].cylinder === 0)) continue;
            const area = regions.cells[eye]?.[field];
            if (!area) continue;
            await untilCancelled(scanWorker.setParameters({
              tessedit_pageseg_mode: PSM.SINGLE_LINE,
              // Preserve explicit PL/PLANO and D.S. instead of forcing letters
              // into digits. The parser still validates every observed token.
              tessedit_char_whitelist: "",
            }));
            readingStatus = `Rechecking ${eye.toUpperCase()} ${field}…`;
            setStatus(readingStatus);
            setProgress(0);
            const cell = focusedCellCanvas(regionSource, area);
            focusedCanvases.push(cell.canvas);
            const heights = regionWords.filter((word) => word.bbox.y0 >= area.top && word.bbox.y1 <= area.top + area.height)
              .map((word) => word.bbox.y1 - word.bbox.y0).sort((a, b) => a - b);
            const cellImages = preparePrescriptionScanImages(cell.canvas, FULL_CROP, {
              estimatedWordHeight: heights[Math.floor(heights.length / 2)], minimumScale: 1.7,
            });
            preparedImages.push(cellImages);
            const retry = await untilCancelled(scanWorker.recognize(cellImages.grayscale, {}, { text: true, blocks: true }));
            if (scanEpoch !== epoch.current) return;
            cellWords = replacePrescriptionCellWords(cellWords, wordsFromBlocks(retry.data.blocks), {
              area, header: regions.header, left: cell.left, top: cell.top, padding: cell.padding,
              scaleX: cellImages.grayscale.width / cell.canvas.width,
              scaleY: cellImages.grayscale.height / cell.canvas.height,
            });
            const candidate = parsePrescriptionScan("", cellWords);
            const otherEye = eye === "od" ? "os" : "od";
            candidate[otherEye] = { sphere: null, cylinder: null, axis: null, add: null };
            candidate.warnings = candidate.warnings.filter((warning) => !warning.startsWith(`${otherEye.toUpperCase()}:`));
            parsed = combinePrescriptionScanPasses(parsed, candidate);
            confidence = Math.min(confidence, retry.data.confidence);
            cellImages.dispose();
            cell.canvas.width = cell.canvas.height = 0;
            if (!parsed.requiresRescan && parsed[eye][field] === null) {
              const inkCell = focusedInkCellCanvas(regionSource, area);
              if (!inkCell) continue;
              focusedCanvases.push(inkCell.canvas);
              readingStatus = `Checking faint ${eye.toUpperCase()} ${field} without the table border…`;
              setStatus(readingStatus);
              setProgress(0);
              const inkRetry = await untilCancelled(scanWorker.recognize(inkCell.canvas, {}, { text: true, blocks: true }));
              if (scanEpoch !== epoch.current) return;
              cellWords = replacePrescriptionCellWords(cellWords, wordsFromBlocks(inkRetry.data.blocks), {
                area, header: regions.header, left: inkCell.left, top: inkCell.top, padding: 0,
                scaleX: inkCell.scaleX, scaleY: inkCell.scaleY,
              });
              const inkCandidate = parsePrescriptionScan("", cellWords);
              inkCandidate[otherEye] = { sphere: null, cylinder: null, axis: null, add: null };
              inkCandidate.warnings = inkCandidate.warnings.filter((warning) => !warning.startsWith(`${otherEye.toUpperCase()}:`));
              parsed = combinePrescriptionScanPasses(parsed, inkCandidate);
              confidence = Math.min(confidence, inkRetry.data.confidence);
              inkCell.canvas.width = inkCell.canvas.height = 0;
            }
          }
        }
      }
      parsed.warnings = parsed.warnings.filter((warning) => {
        for (const eye of ["od", "os"] as const) {
          if (!eyeNeedsReading(parsed[eye]) && (warning.startsWith(`${eye.toUpperCase()}: no clear prescription row`)
            || warning.startsWith(`${eye.toUpperCase()}: this table has extra columns`))) return false;
          for (const field of ["sphere", "cylinder", "axis", "add"] as const) {
            if ((parsed[eye][field] !== null || field === "axis" && parsed[eye].cylinder === 0)
              && (warning.startsWith(`${eye.toUpperCase()}: ${field} contains an unclear`)
                || warning.startsWith(`${eye.toUpperCase()}: ${field} was difficult to read.`))) return false;
          }
        }
        return true;
      });
      if (confidence < 70) parsed.warnings.unshift("Some text was uncertain. Carefully check every value, especially plus/minus signs and axis.");
      setResult(parsed);
      setConfirmed(false);
      setIncludePd(true);
    } catch {
      if (scanEpoch === epoch.current) setError("The scan could not complete. Try a clearer, well-lit photo cropped to the prescription table, or enter the values manually.");
    } finally {
      window.clearTimeout(timeout);
      cleanup();
      if (scanCleanup.current === cleanup) scanCleanup.current = null;
      if (scanAbort.current === abort) scanAbort.current = null;
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
  const completeEyeRows = result ? [result.od, result.os].filter((eye) => !eyeNeedsReading(eye)).length : 0;
  const pd = result?.pupillaryDistance ?? null;
  const validPd = (value: string, min: number, max: number) => Boolean(value.trim()) && Number(value) >= min && Number(value) <= max;
  const pdComplete = !includePd || !pd || (pd.mode === "binocular" ? validPd(pd.binocular, 40, 85) : validPd(pd.right, 20, 45) && validPd(pd.left, 20, 45));
  const displayedCrop = result && scannedCrop ? scannedCrop : crop;
  const hasSelectedCrop = displayedCrop.left !== 0 || displayedCrop.top !== 0 || displayedCrop.width !== 1 || displayedCrop.height !== 1;

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-teal-200 bg-teal-50/60 p-3">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}><ScanLine className="h-4 w-4" />Scan printed Rx</Button>
        <p className="text-xs text-navy-500">Experimental printed-text scan. Handwriting is not reliably supported; review every value.</p>
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-teal-200 bg-white p-4" aria-label="Printed prescription scanner">
      <div className="flex items-start justify-between gap-3">
        <div><h3 className="font-semibold text-navy-900">Scan printed prescription <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">Experimental</span></h3><p className="mt-1 text-xs text-navy-500">Processed on this device. LensWise does not upload or save photos or text. Your camera app may keep a copy when you use Take a photo; crop out identifying details before scanning.</p><p className="mt-2 text-xs text-amber-800">Printed text only. Faint or angled photos can fail even when readable to a person, and handwritten values are not reliably supported. Keep manual entry available.</p></div>
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
          {!result ? <p className="text-xs text-navy-500">{cropMode ? "Drag over the Rx table to crop. Keep the column headings and both eye labels inside the teal box, then press Done cropping." : "The teal outline shows the area to scan. Choose Adjust crop to change it, or Reset crop for the full photo. You can scroll normally over the photo."}</p> : <p className="text-xs text-navy-500">Compare the values below with the original photo. The teal outline shows the selected area that was scanned.</p>}
          <div className={`relative overflow-hidden rounded-lg border border-navy-200 ${cropMode && !result && !busy ? "touch-none cursor-crosshair" : "touch-auto"}`} onPointerDown={startCrop} onPointerMove={dragCrop} onPointerUp={finishCrop} onPointerCancel={cancelCrop} onLostPointerCapture={cancelCrop}>
            <canvas ref={previewCanvas} className="block h-auto w-full" role="img" aria-label="Local prescription photo for review" />
            <div className="pointer-events-none absolute border-2 border-teal-600 bg-teal-500/5" style={{ left: `${displayedCrop.left * 100}%`, top: `${displayedCrop.top * 100}%`, width: `${displayedCrop.width * 100}%`, height: `${displayedCrop.height * 100}%` }} />
          </div>
          <p className="text-xs font-medium text-teal-700" role="status" aria-live="polite">{result || busy ? "Area scanned" : "Area to scan"}: {hasSelectedCrop ? "Selected crop" : "Full photo"}{hasSelectedCrop ? ` (${Math.round(displayedCrop.width * image.width)} × ${Math.round(displayedCrop.height * image.height)} pixels)` : ""}.</p>
          {!result && !busy ? <div className="flex flex-wrap gap-2"><Button variant="ghost" size="sm" onClick={rotatePhoto}><RotateCw className="h-4 w-4" />Rotate</Button><Button variant="secondary" size="sm" aria-pressed={cropMode} onClick={() => cropMode ? doneCropping() : setCropMode(true)}><CropIcon className="h-4 w-4" />{cropMode ? "Done cropping" : "Adjust crop"}</Button><Button variant="ghost" size="sm" onClick={resetCrop}>Reset crop</Button><Button variant="accent" size="sm" disabled={cropMode} onClick={() => void scanPhoto()}><ScanLine className="h-4 w-4" />Read prescription</Button></div> : null}
        </div>
      ) : null}
      {busy ? <div className="space-y-2" role="status" aria-live="polite"><p className="flex items-center gap-2 text-sm text-teal-700"><Loader2 className="h-4 w-4 animate-spin" />{status}{progress > 0 ? ` ${progress}%` : ""}</p><div className="h-2 overflow-hidden rounded-full bg-teal-50"><div className="h-full bg-teal-600" style={{ width: `${Math.max(progress, 5)}%` }} /></div><Button size="sm" variant="ghost" onClick={cancelScan}>Cancel scan</Button></div> : null}
      {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
      {!busy && scanDetails.length > 0 ? <ScanDetails passes={scanDetails} /> : null}
      {result ? (
        <div className="space-y-4">
          <p className="text-xs font-medium text-navy-600" role="status">{completeEyeRows} of 2 eye rows complete for review. Any blank field needs a manual check; signs and ADD always need review.</p>
          {completeEyeRows === 0 ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800" role="alert">No complete eye row could be read reliably. Your prescription has not been changed. You can discard this scan and enter the values manually, or try another straight-on, well-lit photo. Do not fill missing values by guessing.</p> : null}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><p className="font-semibold">Check every value against the paper, including signs, ADD, and axis.</p>{result.warnings.length ? <ul className="mt-2 list-disc space-y-1 pl-4">{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul> : null}</div>
          <div className="grid gap-3 sm:grid-cols-2">{(["od", "os"] as const).map((eye) => <ReviewEye key={eye} eye={eye} values={result[eye]} onChange={(field, value) => updateEye(eye, field, value)} />)}</div>
          {pd ? <div className="rounded-lg border border-navy-100 p-3"><label className="flex items-center gap-2 text-sm font-medium text-navy-700"><input type="checkbox" checked={includePd} onChange={(event) => { setIncludePd(event.target.checked); setConfirmed(false); }} className="h-4 w-4 accent-teal-600" />Also fill the printed PD (mm)</label>{includePd ? <div className="mt-3 flex flex-wrap gap-3">{(pd.mode === "binocular" ? ["binocular"] : ["right", "left"]).map((field) => <div key={field} className="w-28"><Label htmlFor={`scan-pd-${field}`} className="text-xs">{field === "binocular" ? "Total PD" : field === "right" ? "OD / Right" : "OS / Left"}</Label><Input id={`scan-pd-${field}`} inputMode="decimal" maxLength={4} value={pd[field as "binocular" | "right" | "left"]} onChange={(event) => { const value = sanitizePupillaryDistanceValue(event.target.value); setResult((current) => current?.pupillaryDistance ? { ...current, pupillaryDistance: { ...current.pupillaryDistance, [field]: value } } : current); setConfirmed(false); }} /></div>)}</div> : null}</div> : null}
          <label className="flex items-start gap-2 text-sm text-navy-700"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-teal-600" />I checked both eyes, signs, axis, ADD, and any PD against the original prescription.</label>
          {!reviewed ? <p className="text-xs text-red-700">Choose sphere and cylinder for both eyes, plus axis whenever cylinder is not zero.</p> : null}
          {!pdComplete ? <p className="text-xs text-red-700">Check PD: total must be 40–85 mm, or 20–45 mm for each eye. Uncheck the PD option to enter it separately.</p> : null}
          <div className="flex flex-wrap gap-2"><Button variant="accent" disabled={!confirmed || !reviewed || !pdComplete} onClick={() => { if (!confirmed || !reviewed || !pdComplete) return; onReviewed({ prescription: reviewed, pupillaryDistance: includePd ? pd : null }); close(); }}><Check className="h-4 w-4" />Fill prescription fields</Button><Button variant="secondary" onClick={() => { setResult(null); setConfirmed(false); setScanDetails([]); }}>Scan again</Button><Button variant="ghost" onClick={close}>Discard</Button></div>
          <p className="text-xs text-navy-500">The filled prescription remains a draft until you press Apply Prescription.</p>
        </div>
      ) : null}
    </section>
  );
}

/** Only fixed diagnostic metadata is displayed; no OCR text or clinical values. */
function ScanDetails({ passes }: { passes: PrescriptionScanDiagnostics[] }) {
  return <details className="rounded-lg border border-navy-100 bg-navy-50/40 p-3 text-xs text-navy-600">
    <summary className="cursor-pointer font-medium text-navy-800">Scan details (no prescription text)</summary>
    <p className="mt-2">Scanner 2026.10.07.4. These details stay on this device and clear when you close the scanner. If a scan fails, you can share a screenshot of this panel to help troubleshoot.</p>
    <div className="mt-3 space-y-3">{passes.map((detail, index) => <div key={`${detail.pass}-${index}`} className="space-y-1 rounded-lg border border-navy-100 bg-white p-2">
      <p className="font-semibold text-navy-800">{detail.pass === "initial" ? "First reading" : detail.pass === "table" ? "Table-cell reading" : "Enhanced reading"}</p>
      <p>Photo: {detail.sourcePixels.width} × {detail.sourcePixels.height} px · OCR: {detail.ocrPixels.width} × {detail.ocrPixels.height} px · {detail.fullCrop ? "Full photo" : "Cropped area"}</p>
      <p>Words detected: {detail.wordCount} · Eye labels: OD {detail.eyeLabels.od}, OS {detail.eyeLabels.os}</p>
      <p>Separate headings: SPH {detail.standaloneHeadings.sphere}, CYL {detail.standaloneHeadings.cylinder}, AXIS {detail.standaloneHeadings.axis}, ADD {detail.standaloneHeadings.add}</p>
      <p>Merged heading candidates: {detail.mergedHeadings.candidates} · With character data: {detail.mergedHeadings.withSymbols} · Lowest letter confidence: {detail.mergedHeadings.minimumLetterConfidence ?? "unavailable"}</p>
      {detail.mergedHeadings.candidates > 0 ? <p>Character text matches: {detail.mergedHeadings.symbolTextMatches} · Valid boxes: {detail.mergedHeadings.validSymbolBoxes} · Ordered boxes: {detail.mergedHeadings.orderedSymbolBoxes} · Missing confidence: {detail.mergedHeadings.missingLetterConfidence}</p> : null}
      {detail.tableReading ? <p>Printed grids: {detail.tableReading.gridsDetected} · Examined: {detail.tableReading.gridsExamined} · Rx tables: {detail.tableReading.matchedTables} · Labelled eye rows: {detail.tableReading.eyeRows} · Cell readings: {detail.tableReading.cellReads} · Table block: {detail.tableReading.blocker.replace(/_/g, " ")}</p>
        : <p>Aligned table: {detail.table.aligned ? "yes" : "no"} · Eye anchors: OD {detail.table.anchors.od ? "yes" : "no"}, OS {detail.table.anchors.os ? "yes" : "no"} · Layout block: {detail.table.blocker.replace(/_/g, " ")}</p>}
    </div>)}</div>
  </details>;
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
