import type { PublicOwner } from "../types";
import { UserAvatar } from "./UserAvatar";

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

export function ListingAuthor({ owner, className = "", isOwner = false }: {
  owner: ListingAuthorOwner;
  className?: string;
  isOwner?: boolean;
}) {
  const presence = getListingPresence(owner.avatar_name);
  return (
    <span aria-label={`Автор объявления ${owner.avatar_name}${presence ? `, ${presence === "online" ? "онлайн" : "оффлайн"}` : ""}`}
      className={`sm-market-family-owner ${className}`.trim()}>
      <UserAvatar
        name={owner.avatar_name}
        photoUrl={owner.photo_url}
        size={24}
        presence={presence}
      />
      <span className="sm-market-family-avatar-name">
        <span className="sm-market-family-avatar-label">
          {isOwner ? "Вы организатор" : owner.avatar_name}
        </span>
      </span>
    </span>
  );
}
