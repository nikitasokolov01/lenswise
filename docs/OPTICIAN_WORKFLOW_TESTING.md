# Optician workflow release — local acceptance checklist

Nothing should be pushed until the office has reviewed these flows. Use synthetic or deidentified data, not patient names, dates of birth, member IDs, or real payment information. Localhost uses the configured shared backend: saving Settings or confirming payment can affect real office data.

## 1. Reusable adjustments

1. Open the profile menu → Settings → unlock the Office PIN → Pricing.
2. Under **Quick adjustments**, add `First purchase`, choose a fixed-dollar discount, and enter `$100`.
3. Add `Second pair promotion`, choose a percentage discount, and enter `50%`. Save only when you want these to become real office settings.
4. Build a quote to Review. Press the preset. Check its editable label/value and remove it. A preset adds one adjustment each time you press it; do not apply it twice accidentally.

## 2. Frame allowance shortcuts

1. In the same Pricing screen, enable **Frame allowance quick buttons**.
2. Configure up to three different amounts, such as `$100`, `$200`, and `$325`, and save.
3. Build a quote → Review → Use Insurance. The buttons should fill the frame allowance; you can still type any amount manually.
4. A copay/fully covered frame does not use an allowance. Switch frame coverage to Retail to use the shortcut. Disable the shortcuts in Settings and confirm they disappear.

## 3. Printed prescription scanning

1. In the Prescription stage, select **Scan printed Rx** → Choose photo or use the camera. Crop to just the Rx table (including OD/OS and SPH/CYL/AXIS/ADD headings); rotate if needed.
2. A synthetic image is in `docs/testing/sample-prescription.svg`. Expected values: OD `-2.00 -1.25 × 180 ADD +2.00`; OS `+1.50 -0.75 × 90 ADD +2.25`; total PD `63.5`.
3. Select **Read prescription**. The first scan downloads the local scanner assets and may take longer; progress and Cancel should work.
4. Compare every sign and value with the paper. Missing/ambiguous values must be corrected manually. Check the review confirmation, then **Fill prescription fields**. Lens selection must stay locked until **Apply Prescription** is pressed.
5. Test `docs/testing/sample-prescription-extra-columns.svg` with the whole table, including Prism/Base. Expected: OD `-2.00 -1.25 × 180 ADD +2.00`; OS `+1.50 SPH`, blank axis, `ADD +2.25`; total PD `63.5`. The scanner uses column positions so extra columns and blank cells do not shift the optical values. It must warn that prism is not imported.
6. Test a deidentified print from your actual MVE layout. Multiple prescriptions, unclear signs, and unsupported layouts still need a tighter crop or manual entry. Two disagreeing readings leave the affected value blank. Do not rely on OCR alone for an order.
7. Close/cancel a scan and confirm no draft was overwritten. Test denied camera permission and Choose photo fallback on your phone.
8. Test `docs/testing/sample-prescription-mve-layout.svg` without cropping away its extra sections. Expected OD `-2.00 -0.75 × 105`; OS `+0.50 D.S.` (zero cylinder, no axis); no ADD or PD imported. Repeated OD/OS descriptions and the lower Prism/Dec/Inset table must not create duplicate prescriptions or shift numbers into the Rx. A genuine second optical prescription table must still require a tighter crop.
9. With a slightly blurred deidentified photo, watch the scanner recheck faint text and individual number cells. No eye is inferred from row order, and no digit is substituted after OCR. Unsupported/conflicting values remain blank, including conflicts seen across more than two readings. Review all signs against the paper even if both rows were read.
10. Cancel during startup or a number-cell retry, then scan another photo. No late result may overwrite the new scan; closing clears the local processing canvases and stops the worker.

## 4. Camera PD estimate

1. In Prescription, select **Camera PD estimate**. Get the subject's agreement before taking a photo.
2. Follow the instructions for a measured reference at the same depth as the pupils, straight/level head, and distant fixation. A regular photo without calibration cannot produce reliable millimeters.
3. Start live camera and check the head/shoulder outline and front/rear camera switch. The outline is only a framing guide, not a distance measurement. Capture/select a well-lit image: pupil-center marks should be suggested automatically. Choose the reference width, mark its two endpoints, and check/reposition both pupil marks. Use zoom as needed. Manual marking remains available if detection fails.
4. Confirm unusable photos/tilted references show an error. Check the estimate using an optical ruler or pupilometer, then confirm verification and apply.
5. This fills **one-number total PD** only. It does not measure separate monocular PDs or fitting heights, and it is not a replacement for a professional measurement. Use manual values if the result differs.
6. Close the window and confirm the camera indicator turns off. LensWise never uploads/saves photos; the device camera/photo app may retain its own copy after native photo capture.
7. Test a no-face image, multiple faces, closed eyes, and an obviously turned/tilted or blurry face. Confirm a clear explanation appears instead of automatic marks. Close while the model is loading; reopening must not show stale suggestions. Changing marks must reset optical verification.
8. TrueDepth sensor access is not implemented in this website. It requires a native iOS integration and separate accuracy validation; no sensor-derived or uncalibrated physical PD is claimed. See `docs/CAMERA_PD.md`.

## 5. Multiple pairs and second-pair promotions

1. Finish pair one, including an applied Rx and PD, then **Save pair & add another**.
2. Pair two should have the same applied Rx/PD but no frame, lens choices, adjustments, or insurance. Insurance starts at Retail so benefits aren't automatically reused.
3. Choose pair two's products and apply `50%` only to pair two. For frame-only sample prices of `$400` and `$300`, totals should be `$400` and `$150`, combined `$550`.
4. Select each pair's card. Change a frame, PD, or discount on one pair and verify the other pair stays unchanged. New pairs inherit the last applied session Rx/PD; existing pairs are never silently overwritten.
5. Try an excessive discount. That pair should stop at `$0`, without reducing another pair's price.
6. Print Customer Estimate and Internal Worksheet. Both should include every pair and the combined total. Only the worksheet contains Rx/PD, exact frame color/size, and internal notes. Check page breaks on the office printer.
7. Open Patient View and Copy quote summary. Both should include all pairs. Patient View should show a separate heading/card for each pair, with Frame, Lenses, Coating, Upgrades, and Discounts Applied grouped underneath when present. Each card has its own subtotal and insurance, followed by one combined total. Check portrait phone layout: cards should stack without horizontal scrolling.

## 6. Payments, inventory, and clearing a visit

1. Merely quoting, adding/removing a pair, printing, or opening/closing a payment dialog must not change stock.
2. Only test payment with a disposable inventory item/test organization. **Record payment · Pair N** applies to that pair alone and deducts one linked frame from the active location. Payments are recorded separately for each pair; LensWise does not process the money.
3. A recorded pair is marked Paid and cannot be edited/deleted. Retrying the same pair is protected by its own sale key.
4. **New visit / reset** clears all pairs and Rx/PD, creates a fresh sale key, and must not inherit an old Paid state. Existing sale records stay in Sales.
5. Switching locations asks for confirmation and clears the visit so the previous office's frames cannot be sold at the new office. Cancel must keep the quote unchanged.

## Implementation notes

- Pricing schema is v13; old configurations migrate with no presets and disabled allowance shortcuts. No SQL migration, new API key, AI vendor, or paid OCR service is needed.
- Prescriptions and PD are held in this tab's memory only. Refresh, location switch, reset, or leaving the quote page clears them; these are not permanently saved patient orders.
- Self-hosted OCR assets in `public/ocr` total about 15 MB. They are fetched only when scanning, not during ordinary quote entry. One CPU build is selected per device.
- Self-hosted pupil-marker assets in `public/vision` total about 45 MB. A first photo scan fetches about 17 MB (one WASM variant plus the model and JS); no third-party runtime request or photo upload is needed. Single-image processing runs in a worker, not continuous tracking.
- Professional verification of scanned prescriptions and camera PD is required. A deidentified MVE print and physical phone-camera test remain part of office acceptance.

## Verified locally in the follow-up

- Actual OCR recognized all optical fields and printed PD from the extra-column synthetic table, including the blank OS axis, and displayed the prism warning.
- Google's public nonpatient portrait produced two automatic iris-center suggestions; a non-face quote screenshot produced the no-face explanation and no PD value. This proves model startup/marker flow, not physical measurement accuracy.
- The 4032×3024 synthetic `docs/testing/sample-large-no-face.svg` resized to a 2400×1800 in-memory image, showed the resize explanation, and was rejected as no-face. Ordinary phone photos resize the same way, without changing proportions or uploading them.
- A two-pair sample showed pair one `$655` retail minus `$100` = `$555`, pair two `$380` minus `50%` = `$190`, combined `$745`. Requested categories appeared under each pair, not repeated pair prefixes. At phone width, page/dialog width equaled scroll width.
- No sale, inventory change, or Settings save was performed during these follow-up checks. Actual MVE print failures and physical iPhone camera/depth expectations still require office acceptance.
- Final checks: 276 tests across 30 files, lint/type checks, and the optimized production build passed. Release preview is running on port 3200. Changes remain local until user acceptance and push approval.

## Printed-Rx recognition follow-up

- The scanner keeps useful original photo resolution, gently improves faint text, and retries an explicitly labelled missing eye or optical cell. A tightly cropped, perceptual-contrast retry can remove interfering paper/grid edges; it is skipped if a faint sign at the boundary could be lost. No patient photo/text is sent to an OCR service.
- A deidentified crop of the reported MVE failure read both eye rows in the browser, including the missing OS sphere and `D.S.` cylinder. Unprinted ADD/OS axis stayed blank, and unlabeled Far/Near measurements were not imported as PD. The low-confidence and prism warnings remained visible. This is a regression check for one sample, not a guarantee for every blurry photograph.
- The synthetic MVE-style fixture remains safe to share. The original patient PDF and its identifying full-page render are not repository fixtures; only synthetic data is committed.
- Contradictory readings and multiple complete values in a cell remain blank across further retries. The scanner never assigns an unlabeled row to an eye, swaps OD/OS, substitutes digits, or silently resolves conflicting signs.
- Cancel was checked during processing: the scanner returned to the photo controls with no late review result or browser error. Review confirmation is still required before filling; applying the prescription is a separate step.
- Final checks for this recognition update: 364 tests across 32 files, lint/type checks, and an optimized production build. Keep this release local until the office tests the actual phone-camera flow and approves a push.
