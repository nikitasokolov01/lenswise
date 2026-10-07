import type { PrescriptionScanRegion, PrescriptionScanWord } from "@/lib/prescriptionScan";

interface CellWordPlacement {
  area: PrescriptionScanRegion;
  header: PrescriptionScanRegion;
  left: number;
  top: number;
  padding: number;
  scaleX: number;
  scaleY: number;
}

/** Map one OCR cell back to its observed table without replacing eye anchors. */
export function replacePrescriptionCellWords(
  original: PrescriptionScanWord[],
  recognized: PrescriptionScanWord[],
  placement: CellWordPlacement,
): PrescriptionScanWord[] {
  const { area, header, left, top, padding, scaleX, scaleY } = placement;
  if (![scaleX, scaleY].every((value) => Number.isFinite(value) && value > 0)) throw new RangeError("Invalid local OCR scale");
  const inside = (word: PrescriptionScanWord) => {
    const x = (word.bbox.x0 + word.bbox.x1) / 2;
    const y = (word.bbox.y0 + word.bbox.y1) / 2;
    return x > area.left && x < area.left + area.width && y > area.top && y < area.top + area.height;
  };
  const mapped = recognized.map((word) => ({
    ...word,
    bbox: {
      x0: word.bbox.x0 / scaleX - padding + left,
      x1: word.bbox.x1 / scaleX - padding + left,
      y0: word.bbox.y0 / scaleY - padding + top,
      y1: word.bbox.y1 / scaleY - padding + top,
    },
  })).filter(inside);
  return [...original.filter((word) => {
    const label = word.text.replace(/[^a-z0-9]/gi, "").toUpperCase();
    const isEyeLabel = /^(OD|0D|OS|0S|O5|QS|RIGHT|RIGHTEYE|RE|R|LEFT|LEFTEYE|LE|L)$/.test(label);
    const isHeading = word.bbox.y0 >= header.top && word.bbox.y1 <= header.top + header.height;
    return isEyeLabel || isHeading || !inside(word);
  }), ...mapped];
}
