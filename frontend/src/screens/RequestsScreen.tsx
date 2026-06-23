import { Badge, EmptyState, Panel } from "../components/layout";
import { PanelSkeleton } from "../components/skeleton";
import { formatDateTime, statusText } from "../format";
import {
  familyKindLabels,
  requestCancelReasonLabels
} from "../labels";
import type { FamilyRequest } from "../types";
import { openTelegramUser } from "../telegram";

export function RequestsScreen({
  requests,
  busy,
  isLoading,
  onCancelRequest
}: {
  requests: FamilyRequest[];
  busy: string | null;
  isLoading?: boolean;
  onCancelRequest: (requestId: string) => void;
}) {
  return (
    <Panel
      title="Мои заявки"
      description="Повторная заявка после отказа запрещена."
    >
      {isLoading && requests.length === 0 ? (
        <PanelSkeleton lines={3} />
      ) : requests.length === 0 ? (
        <EmptyState title="Заявок пока нет">
          Отправьте заявку в поиске.
        </EmptyState>
      ) : (
        <div className="stack">
          {requests.map((request) => (
            <article
              className="list-row request-card"
              data-testid="request-card"
              key={request.id}
            >
              <div>
                <div className="request-card-heading">
                  <div>
                    <span
                      className={`type-label type-label-${request.family_type}`}
                    >
                      {familyKindLabels[request.family_type]}
                    </span>
                    <strong>
                      {request.service_name}
                      {request.service_variant
                        ? ` ${request.service_variant}`
                        : ""}
                    </strong>
                  </div>
                  <Badge>{statusText(request.status)}</Badge>
                </div>
                <p>
                  Создана {formatDateTime(request.created_at)} · истекает{" "}
                  {formatDateTime(request.expires_at)}
                </p>
                {request.cancel_reason && (
                  <small>
                    {requestCancelReasonLabels[request.cancel_reason] ??
                      request.cancel_reason}
                  </small>
                )}
              </div>
              {request.status === "pending" && (
                <div className="row-actions">
                  {request.owner_username && (
                    <button
                      type="button"
                      className="secondary"
                      data-testid="request-owner-chat-button"
                      onClick={() =>
                        openTelegramUser(
                          request.owner_username!,
                          `Здравствуйте, я оставил заявку в вашу семью ${request.service_name} в SubsMarket.`
                        )
                      }
                    >
                      Написать владельцу
                    </button>
                  )}
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy !== null}
                    onClick={() => onCancelRequest(request.id)}
                  >
                    Отменить
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
}
