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
5. Test a deidentified print from your actual MVE layout. Layouts with multiple prescriptions or extra prism columns may require a tighter crop or manual entry. Unsupported prism is not imported. Do not rely on OCR alone for an order.
6. Close/cancel a scan and confirm no draft was overwritten. Test denied camera permission and Choose photo fallback on your phone.

## 4. Camera PD estimate

1. In Prescription, select **Camera PD estimate**. Get the subject's agreement before taking a photo.
2. Follow the instructions for a measured reference at the same depth as the pupils, straight/level head, and distant fixation. A regular photo without calibration cannot produce reliable millimeters.
3. Capture/select a well-lit image. Choose reference width, then mark both reference endpoints and both pupil centers. Reposition inaccurate marks and use zoom as needed.
4. Confirm unusable photos/tilted references show an error. Check the estimate using an optical ruler or pupilometer, then confirm verification and apply.
5. This fills **one-number total PD** only. It does not measure separate monocular PDs or fitting heights, and it is not a replacement for a professional measurement. Use manual values if the result differs.
6. Close the window and confirm the camera indicator turns off. LensWise never uploads/saves photos; the device camera/photo app may retain its own copy after native photo capture.

## 5. Multiple pairs and second-pair promotions

1. Finish pair one, including an applied Rx and PD, then **Save pair & add another**.
2. Pair two should have the same applied Rx/PD but no frame, lens choices, adjustments, or insurance. Insurance starts at Retail so benefits aren't automatically reused.
3. Choose pair two's products and apply `50%` only to pair two. For frame-only sample prices of `$400` and `$300`, totals should be `$400` and `$150`, combined `$550`.
4. Select each pair's card. Change a frame, PD, or discount on one pair and verify the other pair stays unchanged. New pairs inherit the last applied session Rx/PD; existing pairs are never silently overwritten.
5. Try an excessive discount. That pair should stop at `$0`, without reducing another pair's price.
6. Print Customer Estimate and Internal Worksheet. Both should include every pair and the combined total. Only the worksheet contains Rx/PD, exact frame color/size, and internal notes. Check page breaks on the office printer.
7. Open Patient View and Copy quote summary. Both should include all pairs. Check portrait phone layout: cards should wrap without horizontal scrolling.

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
- Professional verification of scanned prescriptions and camera PD is required. A deidentified MVE print and physical phone-camera test remain part of office acceptance.
