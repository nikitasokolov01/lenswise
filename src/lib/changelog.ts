export const CURRENT_CHANGELOG_RELEASE_ID = "2026-07-26-lenswise-workflow";

export const CURRENT_CHANGELOG = {
  eyebrow: "LensWise update",
  title: "A smoother quote-to-sale workflow",
  summary:
    "This release makes lens selection easier to follow and connects quotes to location-specific frame inventory.",
  highlights: [
    {
      title: "Guided lens selection",
      description:
        "A clearer step-by-step quote builder with visual lens choices and improved price readability.",
    },
    {
      title: "Better prescription details",
      description:
        "One-number or two-number PD entry with safer limits and complete office worksheet printing.",
    },
    {
      title: "Frame catalog and inventory",
      description:
        "Browse frame images by brand, choose exact color and size variants, add several at once, and manage pricing, stock alerts, archive, or delete.",
    },
    {
      title: "Multiple office locations",
      description:
        "Switch locations while keeping each office’s inventory and printed worksheet details separate.",
    },
    {
      title: "Sales and automatic stock tracking",
      description:
        "Record externally collected cash or card payments, deduct sold frames once, and safely void or return inventory from Sales History.",
    },
  ],
} as const;

