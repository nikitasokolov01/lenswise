# Camera PD estimate: scope and verification

The browser workflow now suggests both iris-center markers automatically on a
captured/selected photo. Staff must check these markers against the actual
pupils and can move them manually. Detection rejects no/multiple faces,
missing/cropped landmarks, visibly tilted/turned head geometry, small/closed
eyes, and coarse low-contrast/blurred eye regions. These checks do not certify
measurement accuracy.

Two reference marks on a known measured span are still required. The ruler or
blank card must be level and at approximately pupil depth. LensWise calculates
an estimated total PD from the pupil/reference pixel ratio; staff must verify
the value with an optical ruler or pupilometer before applying it. No automatic
monocular PD, fitting height, distance-to-patient, or clinical accuracy is
claimed. A patient looking at a near phone can converge, so use an appropriate
distant fixation target.

The live head/shoulder outline is a static framing aid only. It does not measure
distance or provide calibration. Rear/front camera switching uses the ordinary
browser video API. If detection cannot run in the browser, manual marks remain
available.

Selected files are limited to 12 MB. Normal phone photos, including 12/24/48 MP
captures, are automatically resized on the device to a maximum 2400-pixel side
before display and inference. The uniform resize preserves image proportions
and normalized marker geometry, and the original object URL is revoked. Invalid
or unusually large decoded images (over 50 MP or a 12000-pixel side) are rejected
with instructions to use the live camera or export a smaller copy.
The model loads only after a photo is selected;
closing the dialog cancels inference. A delayed suggestion never replaces a
pupil marker staff has moved while inference was running.

Safari's camera API does not expose iPhone TrueDepth maps or native camera
calibration. Actual sensor access needs an iOS app/companion using AVFoundation
or ARKit. Apple ARKit eye transforms describe eyeball centers, not an optical
measurement of visible pupil centers, and still require device/clinical
validation before any order-ready PD claim.

Sources:

- [Google's browser FaceLandmarker guide](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js)
- [MediaPipe face model and canonical scale](https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/face_mesh.md)
- [Apple TrueDepth capture](https://developer.apple.com/documentation/avfoundation/streaming-depth-data-from-the-truedepth-camera)
- [Apple eye transform semantics](https://developer.apple.com/documentation/arkit/arfaceanchor/lefteyetransform)
- [Browser media capture specification](https://w3c.github.io/mediacapture-main/)

## Manual acceptance checks

1. Start live camera: check outline and camera toggle, then capture. Camera must
   stop after capture and when closing/navigating away.
2. Choose a sharp, nonpatient test face photo. Both iris-center marks should be
   suggested; check/reposition them and mark the measured reference endpoints.
3. Use a blank or nonface image: the worker should load, return no face, and leave
   manual marking available. Try multiple faces, cropped/tilted, and blurry
   images: detection should explain why it cannot suggest markers.
4. Check that no estimated mm appear until both reference marks exist. Changing
   any marker or reference span must reset the verification checkbox.
5. Verify/adjust the total PD, check the optical verification box, and apply.
   The quote should use one total value; no right/left split is inferred.
6. Close during model loading/inference: no late markers or camera stream should
   remain after reopening. Browser network requests should show only same-host
   model/runtime files and no photo upload.

For a nonpatient model smoke test, Google's own FaceLandmarker tests reference
[`portrait.jpg`](https://storage.googleapis.com/mediapipe-assets/portrait.jpg)
([test source](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/python/test/vision/face_landmarker_test.py)).
That portrait has no measured reference and is not a PD validation fixture.
