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
      <p>{message}</p>
      <button type="button" className="secondary" onClick={onRetry}>
        Повторить
      </button>
    </div>
  );
}