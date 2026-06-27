import type { ReactNode } from "react";

import { statusText } from "../format";
import { statusTone } from "../labels";

export function StatusBadge({
  status,
  children
}: {
  status?: string;
  children?: ReactNode;
}) {
  const label = children ?? (status ? statusText(status) : "");
  const tone = status ? statusTone(status) : "neutral";
  return <span className={`badge badge-${tone}`}>{label}</span>;
}