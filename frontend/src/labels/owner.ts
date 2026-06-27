import type { FamilyMemberRemovalReason } from "../types";

export const memberRemovalReasonLabels: Record<FamilyMemberRemovalReason, string> = {
  no_payment: "Не оплатил",
  no_response: "Нет связи",
  access_issue: "Проблема с доступом",
  mutual_agreement: "По договоренности",
  other: "Другое"
};

export function ownerMemberHint(status: string) {
  const hints: Record<string, string> = {
    awaiting_access: "Следующий шаг: добавьте человека в подписку и нажмите Доступ выдан.",
    awaiting_confirmation: "Участник должен подтвердить, что доступ получен.",
    payment_due: "Участник получил доступ. Теперь он должен оплатить.",
    payment_reported: "Проверьте перевод и подтвердите оплату.",
    active: "Участник активен, первый платеж подтвержден.",
    removal_pending: "Старое отложенное удаление ожидает фоновой обработки."
  };
  return hints[status] ?? "Проверьте статус участника.";
}