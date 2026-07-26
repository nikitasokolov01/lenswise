import type { LensTypeKey, UsageKey } from "@/lib/types";
import { cn } from "@/lib/utils";

export type LensIllustrationKind =
  | UsageKey
  | LensTypeKey
  | "standard_material"
  | "performance_material"
  | "thin_material";

interface LensIllustrationProps {
  kind: LensIllustrationKind;
  className?: string;
}

/**
 * Original, lightweight lens diagrams for the quote wizard. They use
 * currentColor so they stay crisp and readable in both light and dark themes.
 */
export function LensIllustration({ kind, className }: LensIllustrationProps) {
  const isMaterial = kind.endsWith("_material");

  return (
    <svg
      viewBox="0 0 84 72"
      aria-hidden="true"
      className={cn("h-16 w-20", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {isMaterial ? (
        <MaterialDiagram kind={kind as "standard_material" | "performance_material" | "thin_material"} />
      ) : (
        <LensDiagram kind={kind as UsageKey | LensTypeKey} />
      )}
    </svg>
  );
}

function LensDiagram({ kind }: { kind: UsageKey | LensTypeKey }) {
  return (
    <>
      <path
        d="M22 7.5C36.5 4.5 55 8 61.5 19.5C68 31 61.5 52.5 47 62C34 70.5 21.5 62.5 16.5 48C11.5 33.5 9.5 10 22 7.5Z"
        fill="currentColor"
        fillOpacity="0.06"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M18.5 9.5C31 8 50 10.5 57 20"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {kind === "single_vision" || kind === "distance" ? (
        <>
          <path d="M24 29H55" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M28 25L24 29L28 33M51 25L55 29L51 33" stroke="currentColor" strokeWidth="1.7" />
        </>
      ) : null}

      {kind === "progressive" ? (
        <>
          <path
            d="M36 17C48 25 28 38 42 56"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="3 4"
          />
          <circle cx="35" cy="18" r="2.5" fill="currentColor" />
          <circle cx="42" cy="56" r="2.5" fill="currentColor" />
        </>
      ) : null}

      {kind === "bifocal" ? (
        <path
          d="M24 46C33 42.5 45 43 54 46V51C50 59 29 60 24 51V46Z"
          fill="currentColor"
          fillOpacity="0.12"
          stroke="currentColor"
          strokeWidth="1.7"
        />
      ) : null}

      {kind === "reading" ? (
        <>
          <path
            d="M28 43H52V56C47 61 33 61 28 56V43Z"
            fill="currentColor"
            fillOpacity="0.12"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path d="M32 48H48M32 52H45" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : null}

      {kind === "computer" ? (
        <>
          <rect x="25" y="26" width="31" height="20" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M36 50H45M40.5 46V50" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      ) : null}

      {kind === "sunglasses" ? (
        <>
          <path
            d="M17 23C34 18 53 20 62 29C65 40 59 53 47 61C34 68 22 61 17 48C14 39 13 29 17 23Z"
            fill="currentColor"
            fillOpacity="0.16"
          />
          <circle cx="68" cy="13" r="5" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M68 3V0M68 26V23M58 13H55M81 13H78M61 6L58.5 3.5M77.5 22.5L75 20M75 6L77.5 3.5M58.5 22.5L61 20"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      ) : null}
    </>
  );
}

function MaterialDiagram({
  kind,
}: {
  kind: "standard_material" | "performance_material" | "thin_material";
}) {
  const edgeWidth = kind === "thin_material" ? 6 : kind === "performance_material" ? 10 : 14;

  return (
    <>
      <path
        d={`M${42 - edgeWidth / 2} 8C${32 - edgeWidth / 3} 23 ${32 - edgeWidth / 3} 49 ${
          42 - edgeWidth / 2
        } 64`}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d={`M${42 + edgeWidth / 2} 8C${52 + edgeWidth / 3} 23 ${52 + edgeWidth / 3} 49 ${
          42 + edgeWidth / 2
        } 64`}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d={`M${42 - edgeWidth / 2} 8H${42 + edgeWidth / 2}M${42 - edgeWidth / 2} 64H${
          42 + edgeWidth / 2
        }`}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M11 36H29M55 36H73" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
      {kind === "performance_material" ? (
        <path
          d="M67 14L70 20L76 22L70 25L67 31L64 25L58 22L64 20L67 14Z"
          fill="currentColor"
          fillOpacity="0.18"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      ) : null}
      {kind === "thin_material" ? (
        <path d="M24 15L31 9M60 15L53 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      ) : null}
    </>
  );
}
