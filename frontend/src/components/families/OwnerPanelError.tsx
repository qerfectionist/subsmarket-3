import { Button as WorldButton, Typography } from "@worldcoin/mini-apps-ui-kit-react";

export function OwnerPanelError({
  errors,
  onRetry
}: {
  errors: (Error | null)[];
  onRetry: () => void;
}) {
  const message = errors.find(Boolean)?.message ?? "Не удалось загрузить данные владельца";
  return (
    <div className="inline-error owner-panel-error" role="alert">
      <Typography as="p" variant="body" level={3}>
        {message}
      </Typography>
      <WorldButton type="button" variant="secondary" onClick={onRetry}>
        Повторить
      </WorldButton>
    </div>
  );
}
