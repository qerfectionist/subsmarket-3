export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const statusToneMap: Record<string, StatusTone> = {
  active: "success",
  paid: "success",
  approved: "success",
  pending: "warning",
  awaiting_access: "warning",
  awaiting_confirmation: "warning",
  payment_due: "warning",
  payment_reported: "info",
  overdue: "danger",
  rejected: "danger",
  removal_pending: "danger",
  closing: "warning",
  full: "neutral",
  closed: "neutral",
  cancelled: "neutral",
  expired: "neutral",
  left: "neutral",
  removed: "neutral",
  cancelled_before_access: "neutral"
};

export function statusTone(status: string): StatusTone {
  return statusToneMap[status] ?? "neutral";
}

export const statusLabels: Record<string, string> = {
  active: "Активна",
  full: "Заполнена",
  closing: "Закрывается",
  closed: "Закрыта",
  pending: "Ждет ответ",
  approved: "Принята",
  rejected: "Отклонена",
  cancelled: "Отменена",
  expired: "Истекла",
  awaiting_access: "Ждет доступа",
  awaiting_confirmation: "Подтвердите доступ",
  payment_due: "Ждет оплату",
  payment_reported: "Участник отметил оплату",
  paid: "Оплачено",
  overdue: "Просрочено",
  removal_pending: "Удаление обрабатывается",
  left: "Вышел",
  removed: "Удален",
  cancelled_before_access: "Отменено до доступа"
};