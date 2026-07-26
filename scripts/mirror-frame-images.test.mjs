import assert from "node:assert/strict";
import test from "node:test";
import {
  contentTypeForPath,
  mirrorObjectPath,
} from "./mirror-frame-images.mjs";

test("builds a stable storage path without preserving source directories", () => {
  const source = "https://www.framesdata.com/Q120WEB/color_b/275/2756F054.jpg";
  const first = mirrorObjectPath(source);
  const second = mirrorObjectPath(source);

  assert.equal(first, second);
  assert.match(first, /^frames-data\/[0-9a-f]{2}\/[0-9a-f]{64}\.jpg$/);
  assert.equal(first.includes("2756F054"), false);
});

test("normalizes image extensions and MIME types", () => {
  const jpeg = mirrorObjectPath("https://example.com/frame.jpeg?size=large");
  assert.match(jpeg, /\.jpg$/);
  assert.equal(contentTypeForPath(jpeg), "image/jpeg");
  assert.equal(contentTypeForPath("frame.webp"), "image/webp");
});
