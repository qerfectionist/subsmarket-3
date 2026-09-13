import { useId } from "react";
import { SystemSymbol, type SystemSymbolName } from "../SystemSymbol";

import type { ServiceCategory } from "./serviceBranding";

const CATEGORY_ICONS = {
  video_streaming: "play.rectangle",
  music_audio: "music.note",
  education_books: "book",
  cloud_productivity: "cloud",
  security_utilities: "checkmark.shield",
  mobile_tariffs: "iphone",
  default: "play.rectangle"
} as const;

export function CategoryGlyph({ category }: { category: ServiceCategory }) {
  const icon: SystemSymbolName = CATEGORY_ICONS[category];
  const gradientId = `sm-category-silver-gradient-${useId().replace(/:/g, "")}`;

  return (
    <>
      <svg aria-hidden="true" className="sm-category-glyph-defs" focusable="false">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--app-category-icon-gradient-start)" />
            <stop offset="52%" stopColor="var(--app-category-icon-gradient-mid)" />
            <stop offset="100%" stopColor="var(--app-category-icon-gradient-end)" />
          </linearGradient>
        </defs>
      </svg>
      <SystemSymbol
        name={icon}
        size={24}
        className="sm-category-glyph-icon"
        style={{ fill: `url(#${gradientId})` }}
      />
    </>
  );
}
