import { useState } from "react";
import { Select, Typography } from "./ui";
import { DEV_TELEGRAM_USERS, type DevTelegramUser } from "../api";
import { getTelegramPlatform, setDevPlatform } from "../telegram";

export function DevUserSwitch({
  value,
  onChange
}: {
  value: DevTelegramUser;
  onChange: (userId: string) => void;
}) {
  const [platform, setPlatformState] = useState<string>(() => getTelegramPlatform());

  const handlePlatformChange = (p: string) => {
    setPlatformState(p);
    setDevPlatform(p as "ios" | "android" | "tdesktop" | "default");
  };

  return (
    <div
      className="dev-user-compact"
      aria-label="Dev user switch"
      data-testid="dev-user-switch"
      style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}
    >
      <div style={{ flex: 1, minWidth: "140px" }}>
        <Typography as="span" variant="label" level={2}>
          Dev: @{value.username}
        </Typography>
        <div data-testid="dev-user-select" data-value={String(value.id)}>
          <Select
            value={String(value.id)}
            onChange={onChange}
            options={DEV_TELEGRAM_USERS.map((user) => ({
              value: String(user.id),
              label: `${user.label} · @${user.username}`
            }))}
          />
        </div>
      </div>
      <div style={{ minWidth: "110px" }}>
        <Typography as="span" variant="label" level={2}>
          Platform
        </Typography>
        <Select
          value={platform}
          onChange={handlePlatformChange}
          options={[
            { value: "unknown", label: "Auto" },
            { value: "ios", label: "iOS (Mock)" },
            { value: "android", label: "Android" },
            { value: "tdesktop", label: "Desktop" }
          ]}
        />
      </div>
    </div>
  );
}
