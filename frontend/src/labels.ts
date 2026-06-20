import type { FamilyType } from "./types";

export const familyTypeLabels: Record<FamilyType, string> = {
  subscription: "Подписки",
  tariff: "Тарифы"
};

export const familyKindLabels: Record<FamilyType, string> = {
  subscription: "Семья подписки",
  tariff: "Семья тарифа"
};

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
  awaiting_confirmation: "Доступ выдан, ждет подтверждения",
  payment_due: "Ждет оплату",
  payment_reported: "Участник отметил оплату",
  paid: "Оплачено",
  overdue: "Просрочено",
  removal_pending: "Удаление обрабатывается",
  left: "Вышел",
  removed: "Удален",
  cancelled_before_access: "Отменено до доступа"
};

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

export const requestCancelReasonLabels: Record<string, string> = {
  user_cancelled: "Заявка отменена вами.",
  family_full: "Семья заполнилась до решения владельца."
};

export const paymentCancelReasonLabels: Record<string, string> = {
  member_left: "Участник вышел из семьи.",
  member_removed: "Участник удален из семьи.",
  family_closing: "Семья находится в процессе закрытия.",
  family_closed: "Семья закрыта."
};

export const errorLabels: Record<string, string> = {
  USERNAME_REQUIRED: "Создайте username в Telegram и снова откройте SubsMarket.",
  TELEGRAM_INIT_DATA_REQUIRED: "Откройте SubsMarket через Telegram Mini App.",
  TELEGRAM_INIT_DATA_EXPIRED: "Сессия Telegram устарела. Закройте и снова откройте Mini App.",
  TELEGRAM_INIT_DATA_HASH_INVALID: "Не удалось проверить Telegram-сессию. Откройте Mini App заново.",
  TELEGRAM_INIT_DATA_HASH_MISSING: "Telegram не передал данные для проверки. Откройте Mini App заново.",
  TELEGRAM_INIT_DATA_AUTH_DATE_MISSING: "Telegram не передал время сессии. Откройте Mini App заново.",
  TELEGRAM_INIT_DATA_AUTH_DATE_INVALID: "Telegram передал некорректную сессию. Откройте Mini App заново.",
  TELEGRAM_INIT_DATA_USER_MISSING: "Telegram не передал профиль пользователя. Откройте Mini App заново.",
  TELEGRAM_INIT_DATA_USER_INVALID: "Telegram передал некорректный профиль. Откройте Mini App заново.",
  TELEGRAM_BOT_TOKEN_NOT_CONFIGURED: "Mini App пока не настроен для проверки Telegram-сессии.",
  TELEGRAM_WEBHOOK_SECRET_REQUIRED: "Webhook бота не настроен.",
  TELEGRAM_WEBHOOK_SECRET_INVALID: "Webhook бота отклонён из-за неверной проверки.",
  DATABASE_NOT_READY: "База данных пока недоступна. Попробуйте ещё раз через минуту.",
  NOT_FOUND: "Запись не найдена.",
  FAMILY_SERVICE_NOT_FOUND: "Сервис не найден или пока недоступен.",
  UNSUPPORTED_FAMILY_PERIOD: "Этот период оплаты недоступен для выбранного сервиса.",
  MAX_MEMBERS_EXCEEDS_SERVICE_LIMIT: "Количество мест больше лимита выбранного сервиса.",
  OWNER_ACTIVE_FAMILY_LIMIT_REACHED: "Бесплатно можно быть владельцем только двух активных семей.",
  FAMILY_NOT_FOUND: "Семья не найдена.",
  FAMILY_MEMBER_NOT_FOUND: "Участник семьи не найден.",
  FAMILY_PAYMENT_NOT_FOUND: "Платёж не найден.",
  FAMILY_NOT_JOINABLE: "В эту семью сейчас нельзя отправить заявку.",
  FAMILY_NOT_EDITABLE: "Эту семью сейчас нельзя редактировать.",
  FAMILY_PRICE_NOT_EDITABLE: "Цену этой семьи сейчас нельзя изменить.",
  FAMILY_PRICE_ALREADY_UPDATED: "Цену можно менять только один раз в месяц.",
  FAMILY_PAYMENT_DAY_LOCKED: "Дату оплаты можно менять только пока семья ещё не собрана.",
  FAMILY_PAYMENT_DAY_NOT_EDITABLE: "Дату оплаты этой семьи сейчас нельзя изменить.",
  FAMILY_AUDIT_FORBIDDEN: "История семьи доступна только её участникам.",
  ONLY_OWNER_CAN_CHANGE_FAMILY: "Изменять семью может только владелец.",
  OWNER_CANNOT_REQUEST_OWN_FAMILY: "Нельзя отправить заявку в свою семью.",
  ALREADY_IN_FAMILY: "Вы уже состоите в этой семье.",
  FAMILY_REQUEST_FORBIDDEN: "В эту семью повторная заявка недоступна. Выберите другую семью.",
  FAMILY_REQUEST_ALREADY_PENDING: "Заявка уже отправлена. Дождитесь ответа или отмените её.",
  SELF_CANCEL_LIMIT_REACHED: "Вы уже дважды отменяли заявку в эту семью. Повторная заявка недоступна.",
  FAMILY_REQUEST_NOT_FOUND: "Заявка не найдена.",
  FAMILY_REQUEST_NOT_PENDING: "Эта заявка уже не ожидает решения.",
  ONLY_OWNER_CAN_VIEW_REQUESTS: "Заявки может смотреть только владелец семьи.",
  ONLY_OWNER_CAN_APPROVE_REQUEST: "Принять заявку может только владелец семьи.",
  ONLY_OWNER_CAN_REJECT_REQUEST: "Отклонить заявку может только владелец семьи.",
  ONLY_OWNER_CAN_VIEW_MEMBERS: "Участников может смотреть только владелец семьи.",
  MEMBER_CANCEL_FORBIDDEN: "Отменить это вступление может только кандидат или владелец семьи.",
  OWNER_CANNOT_CANCEL_MEMBERSHIP: "Владелец не может отменить своё участие в семье.",
  MEMBER_NOT_AWAITING_ACCESS: "Для этого участника сейчас нельзя выдать доступ.",
  MEMBER_NOT_AWAITING_CONFIRMATION: "Доступ уже подтверждён или этот шаг недоступен.",
  MEMBER_NOT_ACTIVE: "Этот участник сейчас не активен.",
  ACCESS_NOT_CONFIRMED: "Реквизиты откроются только после подтверждения доступа.",
  ONLY_OWNER_CAN_PROVIDE_ACCESS: "Выдать доступ может только владелец семьи.",
  ONLY_OWNER_CAN_REMIND_ACCESS_CONFIRMATION: "Напомнить о доступе может только владелец семьи.",
  ACCESS_REMINDER_COOLDOWN: "Напоминание уже отправлено. Повторите через 10 минут.",
  OWNER_ACCESS_ALREADY_ACTIVE: "Доступ владельца уже активен.",
  ONLY_MEMBER_CAN_CONFIRM_ACCESS: "Подтвердить доступ может только сам участник.",
  PAYMENT_NOT_REPORTABLE: "Этот платёж сейчас нельзя отметить оплаченным.",
  PAYMENT_REPORT_NOT_ACTIVE: "Отметка оплаты уже не активна.",
  PAYMENT_NOT_REPORTED: "Владелец может подтвердить только платёж, отмеченный участником.",
  PAYMENT_REQUISITE_NOT_FOUND: "Реквизиты оплаты не найдены.",
  PAYMENT_REQUISITE_FORBIDDEN: "Реквизиты доступны только участнику и владельцу семьи.",
  FAMILY_PAYMENTS_FORBIDDEN: "Платежи доступны только участнику и владельцу семьи.",
  ONLY_MEMBER_CAN_PREPAY: "Создать предоплату может только сам участник.",
  ONLY_OWNER_CAN_RECORD_PREPAYMENT: "Несколько оплаченных периодов может отметить только владелец.",
  MEMBER_NOT_ELIGIBLE_FOR_PREPAYMENT: "Предоплата доступна только активному участнику.",
  FAMILY_NOT_ELIGIBLE_FOR_PREPAYMENT: "В закрывающейся или закрытой семье предоплата недоступна.",
  MEMBER_PREPAYMENT_LIMIT_REACHED: "Ближайший будущий период уже создан. Несколько периодов отмечает владелец после договоренности.",
  YEARLY_PREPAYMENT_LIMIT_REACHED: "За один раз можно отметить не больше трех годовых периодов.",
  ONLY_MEMBER_CAN_REPORT_PAYMENT: "Отметить оплату может только участник.",
  ONLY_MEMBER_CAN_CANCEL_REPORT: "Отменить отметку оплаты может только участник.",
  ONLY_OWNER_CAN_CONFIRM_PAYMENT: "Подтвердить оплату может только владелец семьи.",
  ONLY_OWNER_CAN_MARK_NOT_RECEIVED: "Отметить неоплату может только владелец семьи.",
  ONLY_MEMBER_CAN_LEAVE: "Выйти из семьи может только сам участник.",
  OWNER_MUST_CLOSE_FAMILY: "Владелец не может просто выйти. Сначала нужно закрыть семью.",
  OWNER_CANNOT_REMOVE_SELF: "Владелец не может удалить себя из семьи.",
  ONLY_OWNER_CAN_REMOVE_MEMBER: "Удалить участника может только владелец семьи.",
  ONLY_OWNER_CAN_REVOKE_REMOVAL: "Отменить удаление может только владелец семьи.",
  MEMBER_NOT_REMOVABLE: "Этого участника сейчас нельзя поставить на удаление.",
  MEMBER_REMOVAL_NOT_PENDING: "Удаление участника сейчас не запланировано.",
  ONLY_MEMBER_CAN_ACK_REMOVAL: "Подтвердить предупреждение об удалении может только сам участник.",
  ONLY_MEMBER_CAN_REQUEST_REMOVAL_CANCELLATION:
    "Попросить отменить удаление может только сам участник.",
  FAMILY_ALREADY_CLOSED: "Семья уже закрыта.",
  FAMILY_NOT_CLOSING: "Семья сейчас не находится в процессе закрытия.",
  INVALID_PAYMENT_PHONE: "Укажите номер телефона для оплаты. Номера карт и IBAN запрещены.",
  PAYMENT_PHONE_ONLY_NO_CARD_OR_IBAN: "Укажите только номер телефона. Номера карт и IBAN запрещены.",
  INVALID_INTERNAL_JOB_TOKEN: "Внутренний токен задания неверный.",
  INVALID_FAMILY_INVITE_CODE: "Введите код приглашения из 8 цифр.",
  FAMILY_INVITE_NOT_FOUND: "Код приглашения не найден.",
  FAMILY_INVITE_INACTIVE: "Этот код больше не действует.",
  FAMILY_INVITE_NOT_ACCEPTING: "Семья сейчас не принимает новых участников.",
  FAMILY_INVITE_NOT_EDITABLE: "Для закрывающейся семьи код приглашения недоступен.",
  FAMILY_INVITE_NOT_ACTIVE: "У семьи сейчас нет активного кода приглашения.",
  ONLY_OWNER_CAN_VIEW_INVITE: "Код приглашения доступен только владельцу семьи.",
  FAMILY_VISIBILITY_NOT_EDITABLE: "Видимость закрывающейся семьи изменить нельзя.",
  RATE_LIMIT_EXCEEDED: "Слишком много попыток. Повторите позже.",
  INTERNAL_JOB_TOKEN_REQUIRED: "Внутренний токен задания не настроен."
};
