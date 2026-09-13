import type { ReactNode } from "react";
import { Button } from "./ui";

type QueryState = {
  isLoading: boolean;
  isError: boolean;
  refetch: () => unknown;
};

export function AsyncContent({
  query, children, label = "Загружаем..."
}: { query: QueryState; children: ReactNode; label?: string }) {
  if (query.isLoading) {
    return <div className="ui-feedback" role="status"><span className="ui-loading-dot" aria-hidden />{label}</div>;
  }
  if (query.isError) {
    return (
      <div className="ui-feedback ui-feedback-error" role="alert">
        <strong>Не удалось загрузить данные</strong>
        <p>Проверьте соединение и попробуйте ещё раз.</p>
        <Button variant="secondary" onClick={() => void query.refetch()}>Повторить</Button>
      </div>
    );
  }
  return <>{children}</>;
}
