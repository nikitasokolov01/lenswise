# Local prescription OCR assets

These public files are runtime assets, not prescription data. LensWise processes
photos entirely in a browser Web Worker; it never uploads the photo or OCR text.

- `worker.min.js`: Tesseract.js 7.0.0 (Apache-2.0).
- `core/*-lstm.wasm.js`: Tesseract.js-core 7.0.0, embedded WebAssembly builds
  for standard, SIMD, and relaxed-SIMD browsers (Apache-2.0).
- `eng.traineddata`: English LSTM model from the official
  https://github.com/tesseract-ocr/tessdata_fast repository (Apache-2.0).
- License notices are included alongside these files.

The OCR client explicitly sets workerPath, corePath, and langPath to `/ocr`,
uses LSTM_ONLY, and disables persistent language caching. Only static model
assets are downloaded; no third-party runtime endpoint is used.

When upgrading Tesseract.js, replace the worker and all three LSTM core builds
from the matching installed versions. Do not use the CDN defaults.
