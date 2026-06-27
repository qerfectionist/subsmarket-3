export const periodLabels = {
  monthly: "месяц",
  yearly: "год"
};

export const bankLabels = {
  kaspi: "Kaspi",
  halyk: "Halyk",
  freedom: "Freedom",
  jusan: "Jusan"
};

export const paymentCancelReasonLabels: Record<string, string> = {
  member_left: "Участник вышел из семьи.",
  member_removed: "Участник удален из семьи.",
  family_closing: "Семья находится в процессе закрытия.",
  family_closed: "Семья закрыта."
};

export function paymentKindText(kind: string) {
  const labels: Record<string, string> = {
    first: "первый платеж",
    prepaid: "предоплата",
    regular: "регулярный платеж"
  };
  return labels[kind] ?? kind;
}