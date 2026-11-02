import { Button as AppButton } from "./ui";
import { Shell } from "./layout";
import { formatError } from "../format";
import { openTelegramMiniApp } from "../telegram";
import type { MeResponse } from "../types";

export function AppLoadNotice({
  loadState,
  me,
  meError,
  onRefreshProfile,
  onRetry
}: {
  loadState: "loading" | "username-required" | "error";
  me?: MeResponse | null;
  meError: unknown;
  onRefreshProfile: () => void;
  onRetry: () => void;
}) {
  if (loadState === "loading") {
    return <Shell title="SubsMarket">Загружаем Mini App...</Shell>;
  }

  if (loadState === "username-required") {
    return (
      <Shell title="Нужен Telegram username">
        <div className="notice">
          <p>{me?.message}</p>
          <ol>
            <li>Откройте настройки Telegram.</li>
            <li>Создайте username.</li>
            <li>Вернитесь в SubsMarket и обновите профиль.</li>
          </ol>
          <AppButton type="button" fullWidth onClick={onRefreshProfile}>
            Я создал username
          </AppButton>
        </div>
      </Shell>
    );
  }

  const loadErrorMessage = formatError(meError);
  const requiresTelegram = loadErrorMessage.includes("Telegram Mini App");
  return (
    <Shell title="Backend недоступен">
      <div className="notice notice-error">
        <p>{loadErrorMessage}</p>
        <div className="notice-actions">
          {requiresTelegram && (
            <AppButton type="button" fullWidth onClick={openTelegramMiniApp}>
              Открыть в Telegram
            </AppButton>
          )}
          <AppButton
            type="button"
            fullWidth
            variant={requiresTelegram ? "secondary" : "primary"}
            onClick={onRetry}
          >
            Повторить
          </AppButton>
        </div>
      </div>
    </Shell>
  );
}
