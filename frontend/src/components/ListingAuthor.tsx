import { useState } from "react";
import type { PublicOwner } from "../types";

type ListingAuthorOwner = Pick<PublicOwner, "avatar_name"> & {
  photo_url?: string | null;
};

export type ListingPresence = "online" | "offline";

const demoPresenceByName: Record<string, ListingPresence> = {
  aquabadger: "online",
  dustyotter: "online",
  babyturtle: "offline",
  lunarsalamander: "offline"
};

export function getListingPresence(name: string): ListingPresence | undefined {
  if (!import.meta.env.DEV) return undefined;
  const normalized = name.trim().toLocaleLowerCase();
  if (!normalized) return undefined;
  if (demoPresenceByName[normalized]) return demoPresenceByName[normalized];
  const checksum = Array.from(normalized).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return checksum % 2 === 0 ? "online" : "offline";
}

export function ListingAuthor({ owner, className = "" }: {
  owner: ListingAuthorOwner;
  className?: string;
}) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const initial = owner.avatar_name.trim().slice(0, 1).toUpperCase() || "?";
  const presence = getListingPresence(owner.avatar_name);
  return (
    <span aria-label={`Автор объявления ${owner.avatar_name}${presence ? `, ${presence === "online" ? "онлайн" : "оффлайн"}` : ""}`}
      className={`sm-market-family-owner ${className}`.trim()}>
      <span aria-hidden className="sm-market-family-owner-avatar">
        {owner.photo_url && failedPhoto !== owner.photo_url ? (
          <img alt="" src={owner.photo_url} onError={() => setFailedPhoto(owner.photo_url!)} />
        ) : initial}
        {presence ? (
          <span
            aria-hidden
            className={`sm-market-owner-presence is-${presence}`}
            title={presence === "online" ? "Онлайн" : "Оффлайн"}
          />
        ) : null}
      </span>
      <span className="sm-market-family-avatar-name">
        <span className="sm-market-family-avatar-label">{owner.avatar_name}</span>
      </span>
    </span>
  );
}
