import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button as AppButton, Input } from "../ui";
import { SystemSymbol } from "../SystemSymbol";
import { formatError } from "../../format";
import { useConnectWhatsappChat, useSetFamilyChatKind } from "../../hooks/api";
import { queryKeys } from "../../hooks/api/queryKeys";
import {
  openExternalLink,
  openTelegramLink,
  triggerTelegramNotification
} from "../../telegram";
import type { FamilyChat } from "../../types";

/** How long the panel keeps checking whether the bot joined the new group. */
const TELEGRAM_POLL_MS = 4000;
const TELEGRAM_POLL_LIMIT_MS = 5 * 60 * 1000;
const WHATSAPP_LINK_RE = /^(?:https?:\/\/)?chat\.whatsapp\.com\/(?:invite\/)?[A-Za-z0-9]{10,40}\/?(?:\?.*)?$/;

export function openFamilyChat(chat: FamilyChat) {
  if (!chat.invite_url) return;
  if (chat.kind === "telegram") openTelegramLink(chat.invite_url);
  else openExternalLink(chat.invite_url);
}

/** «Чат семьи» for the owner and added members once the chat is connected. */
export function FamilyChatButton({ chat }: { chat: FamilyChat | null | undefined }) {
  if (!chat?.invite_url) return null;
  return (
    <AppButton
      type="button"
      variant="secondary"
      size="sm"
      data-testid="family-chat-button"
      data-chat-url={chat.invite_url}
      onClick={() => openFamilyChat(chat)}
    >
      {chat.kind === "telegram" ? "Чат в Telegram" : "Чат в WhatsApp"}
    </AppButton>
  );
}

/** Owner's steps to connect the family chat in Telegram or WhatsApp. */
export function FamilyChatConnect({
  familyId,
  chat,
  groupName
}: {
  familyId: string;
  chat: FamilyChat;
  groupName: string;
}) {
  const queryClient = useQueryClient();
  const setKind = useSetFamilyChatKind();
  const connectWhatsapp = useConnectWhatsappChat();
  const [link, setLink] = useState("");
  const [linkTouched, setLinkTouched] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const waiting = chat.kind === "telegram" && chat.status === "pending";

  // The bot reports the new group to the server; keep asking for a while.
  useEffect(() => {
    if (!waiting) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() - started > TELEGRAM_POLL_LIMIT_MS) {
        window.clearInterval(timer);
        return;
      }
      if (document.visibilityState === "visible") {
        void queryClient.invalidateQueries({ queryKey: queryKeys.myFamilies });
      }
    }, TELEGRAM_POLL_MS);
    return () => window.clearInterval(timer);
  }, [waiting, queryClient]);

  async function switchTo(kind: FamilyChat["kind"]) {
    setError(null);
    try {
      await setKind.mutateAsync({ familyId, kind });
    } catch (caught) {
      setError(formatError(caught));
    }
  }

  async function copyName() {
    try {
      await navigator.clipboard?.writeText(groupName);
      setCopied(true);
      triggerTelegramNotification("success");
    } catch {
      setCopied(false);
    }
  }

  async function saveLink() {
    setLinkTouched(true);
    if (!WHATSAPP_LINK_RE.test(link.trim())) return;
    setError(null);
    try {
      await connectWhatsapp.mutateAsync({ familyId, url: link.trim() });
      triggerTelegramNotification("success");
    } catch (caught) {
      setError(formatError(caught));
    }
  }

  if (chat.status === "connected") {
    return (
      <section className="family-chat-panel" data-testid="family-chat-panel" data-chat-status="connected">
        <p className="family-chat-done">
          <SystemSymbol name="checkmark" size={16} />
          {chat.kind === "telegram" ? "Чат в Telegram подключён" : "Чат в WhatsApp подключён"}
        </p>
        <p className="family-chat-lead">
          Участники получат ссылку на чат, когда вы добавите их в семью.
        </p>
        <FamilyChatButton chat={chat} />
      </section>
    );
  }

  const linkInvalid = linkTouched && !WHATSAPP_LINK_RE.test(link.trim());
  return (
    <section className="family-chat-panel" data-testid="family-chat-panel" data-chat-status="pending" data-chat-kind={chat.kind}>
      <h3>Подключите чат семьи</h3>
      {chat.kind === "telegram" ? (
        <>
          <p className="family-chat-lead">
            Telegram откроет выбор группы. Нажмите «Создать группу» — бот уже будет в ней
            и сам пришлёт ссылку для участников.
          </p>
          <AppButton
            type="button"
            data-testid="family-chat-create-telegram"
            onClick={() => chat.connect_url && openTelegramLink(chat.connect_url)}
          >
            Создать чат
          </AppButton>
          <p className="family-chat-wait" aria-live="polite">
            Ждём, когда бот появится в группе…
          </p>
        </>
      ) : (
        <>
          <ol className="family-chat-steps">
            <li>
              <span>Скопируйте название группы</span>
              <button type="button" data-testid="family-chat-copy-name" onClick={() => void copyName()}>
                {copied ? "Скопировано" : groupName}
              </button>
            </li>
            <li>
              <span>Создайте группу в WhatsApp с этим названием</span>
              <button
                type="button"
                data-testid="family-chat-open-whatsapp"
                onClick={() => openExternalLink("https://wa.me/")}
              >
                Открыть WhatsApp
              </button>
            </li>
            <li>
              <span>В группе: «Пригласить по ссылке» → «Копировать ссылку». Вставьте её сюда</span>
            </li>
          </ol>
          <div>
            <Input
              aria-label="Ссылка на группу WhatsApp"
              placeholder="https://chat.whatsapp.com/…"
              data-testid="family-chat-whatsapp-input"
              inputMode="url"
              autoComplete="off"
              error={linkInvalid}
              value={link}
              onBlur={() => setLinkTouched(true)}
              onChange={(event) => setLink(event.target.value)}
            />
            {linkInvalid ? (
              <small className="field-error" role="alert">
                Нужна ссылка вида chat.whatsapp.com/… из «Пригласить по ссылке»
              </small>
            ) : null}
          </div>
          <AppButton
            type="button"
            data-testid="family-chat-save-whatsapp"
            disabled={connectWhatsapp.isPending || !link.trim()}
            onClick={() => void saveLink()}
          >
            Сохранить ссылку
          </AppButton>
        </>
      )}
      {error ? (
        <small className="field-error" role="alert">
          {error}
        </small>
      ) : null}
      <button
        type="button"
        className="family-chat-switch"
        data-testid="family-chat-switch"
        disabled={setKind.isPending}
        onClick={() => void switchTo(chat.kind === "telegram" ? "whatsapp" : "telegram")}
      >
        {chat.kind === "telegram" ? "Лучше WhatsApp" : "Лучше Telegram"}
      </button>
    </section>
  );
}
