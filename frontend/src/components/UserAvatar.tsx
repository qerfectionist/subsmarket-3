import { useMemo, useState } from "react";
import type { ListingPresence } from "./ListingAuthor";

/**
 * Палитра сочных mesh/radial градиентов в стиле референса:
 * гармоничные переходы (фиолетовый -> желтый, индиго -> циан, лайм -> оранжевый и т.д.)
 */
const MESH_GRADIENTS = [
  // 1. Purple -> Warm Yellow (1-в-1 как 1-й аватар в референсе)
  "radial-gradient(circle at 28% 28%, #c084fc 0%, #a855f7 38%, #fbbf24 100%)",
  // 2. Violet -> Cyan -> Emerald (1-в-1 как 2-й аватар в референсе)
  "radial-gradient(circle at 30% 25%, #a78bfa 0%, #6366f1 40%, #06b6d4 80%, #10b981 100%)",
  // 3. Lime / Green -> Warm Amber (1-в-1 как 3-й аватар в референсе)
  "radial-gradient(circle at 28% 28%, #a3e635 0%, #84cc16 38%, #f97316 100%)",
  // 4. Rose -> Sunset Coral
  "radial-gradient(circle at 25% 25%, #f472b6 0%, #fb7185 42%, #f59e0b 100%)",
  // 5. Electric Sky -> Deep Indigo
  "radial-gradient(circle at 30% 25%, #38bdf8 0%, #3b82f6 45%, #8b5cf6 100%)",
  // 6. Aquamarine -> Mint -> Gold
  "radial-gradient(circle at 25% 25%, #2dd4bf 0%, #14b8a6 42%, #eab308 100%)",
  // 7. Orchid Fuchsia -> Warm Peach
  "radial-gradient(circle at 28% 28%, #e879f9 0%, #d946ef 45%, #fb923c 100%)",
  // 8. Tangerine -> Crimson -> Lavender
  "radial-gradient(circle at 30% 30%, #fb923c 0%, #f43f5e 48%, #c084fc 100%)",
  // 9. Emerald -> Cobalt Blue
  "radial-gradient(circle at 25% 25%, #34d399 0%, #059669 45%, #0284c7 100%)",
  // 10. Warm Amber -> Hot Magenta
  "radial-gradient(circle at 25% 30%, #fcd34d 0%, #f59e0b 38%, #ec4899 92%)",
  // 11. Iris Violet -> Soft Coral
  "radial-gradient(circle at 30% 25%, #818cf8 0%, #a855f7 46%, #fb7185 100%)",
  // 12. Jade -> Sun Yellow
  "radial-gradient(circle at 28% 28%, #4ade80 0%, #22c55e 42%, #eab308 100%)"
];

/** Детерминированный хэш строки для выбора градиента */
export function getAvatarGradient(name: string): string {
  const normalized = (name || "").trim().toLowerCase();
  if (!normalized) return MESH_GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % MESH_GRADIENTS.length;
  return MESH_GRADIENTS[index];
}

export type UserAvatarProps = {
  name: string;
  photoUrl?: string | null;
  size?: number;
  className?: string;
  presence?: ListingPresence;
};

export function UserAvatar({
  name,
  photoUrl,
  size = 24,
  className = "",
  presence
}: UserAvatarProps) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);

  const initial = useMemo(() => {
    const trimmed = (name || "").trim();
    if (!trimmed) return "?";
    // Убираем leading @ если передан username
    const clean = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
    return clean.slice(0, 1).toUpperCase() || "?";
  }, [name]);

  const backgroundGradient = useMemo(() => {
    return getAvatarGradient(name);
  }, [name]);

  const hasPhoto = Boolean(photoUrl && failedPhoto !== photoUrl);

  const fontSize = Math.max(10, Math.round(size * 0.46));

  return (
    <span
      aria-hidden
      className={`sm-market-family-owner-avatar sm-user-avatar-mesh ${className}`.trim()}
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        background: hasPhoto ? "var(--app-secondary-bg)" : backgroundGradient,
        color: "#ffffff",
        fontSize: `${fontSize}px`,
        fontWeight: 600,
        textShadow: hasPhoto ? "none" : "0 1px 2px rgba(0, 0, 0, 0.32)",
        boxShadow: hasPhoto ? "none" : "inset 0 0 0 1px rgba(255, 255, 255, 0.14)"
      }}
    >
      {hasPhoto ? (
        <img
          alt=""
          src={photoUrl!}
          onError={() => setFailedPhoto(photoUrl!)}
          style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
        />
      ) : (
        initial
      )}
      {presence ? (
        <span
          aria-hidden
          className={`sm-market-owner-presence is-${presence}`}
          title={presence === "online" ? "Онлайн" : "Оффлайн"}
        />
      ) : null}
    </span>
  );
}
