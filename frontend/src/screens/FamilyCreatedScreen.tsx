import { useState } from "react";
import { Button as AppButton, Typography, useToast } from "../components/ui";
import { Panel } from "../components/layout";
import { ServiceLogo } from "../components/branding";
import { FamilyChatConnect } from "../components/families/FamilyChatPanel";
import { formatKzt, pluralRu } from "../components/families/createFamilyForm";
import { familyTitle } from "../format";
import { useTelegramBackButton, useTelegramMainButton } from "../hooks/useTelegramAppEffects";
import { useFamilyInvite } from "../hooks/api/families-queries";
import { canUseTelegramMainButton } from "../telegram";
import type { MyFamily } from "../types";

/** Step 4: the family exists; now the owner connects its chat. */
export function FamilyCreatedScreen({
  item,
  onDone
}: {
  item: MyFamily | null;
  onDone: () => void;
}) {
  const chat = item?.chat ?? null;
  const connected = chat?.status === "connected";
  const [nativeMainButton] = useState(canUseTelegramMainButton);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const familyId = item?.family.id ?? null;
  const inviteQuery = useFamilyInvite(familyId);
  const invite = inviteQuery.data ?? null;

  useTelegramBackButton(true, onDone);
  useTelegramMainButton({
    visible: nativeMainButton,
    label: connected || !chat ? "Готово" : "Подключить позже",
    onClick: onDone,
    isPending: false,
    disabled: false
  });

  const handleCopyCode = async (code: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const input = document.createElement("textarea");
        input.value = code;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      }
      setCopied(true);
      toast.success({ title: "Код скопирован" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error({ title: "Не удалось скопировать" });
    }
  };

  if (!item) {
    return (
      <Panel title="Семья создана">
        <div className="screen-body-inset">
          <p className="family-chat-lead">Загружаем семью…</p>
        </div>
      </Panel>
    );
  }

  const { family } = item;
  const free = Math.max(0, family.max_members - family.active_members_count);
  const title = familyTitle(family);
  return (
    <Panel title="Семья создана">
      <div className="screen-body-inset family-created" data-testid="family-created-screen">
        <section
          className="create-live-card"
          aria-label={family.is_search_visible ? "Ваша семья в маркете" : "Приватная семья"}
        >
          <span className="create-live-caption">
            {family.is_search_visible ? "Уже в маркете" : "Приватная семья"}
          </span>
          <div className="create-live-head">
            <ServiceLogo
              serviceSlug={family.service_slug}
              serviceName={family.service_name}
              familyType={family.family_type === "tariff" ? "tariff" : "subscription"}
              size={44}
              loading="eager"
            />
            <div className="create-live-title">
              <strong>{title}</strong>
              <span>Семья</span>
            </div>
            <div className="create-live-price">
              <strong>{formatKzt(family.member_share_kzt)}</strong>
              <span>в месяц</span>
            </div>
          </div>
          <div className="create-live-chips">
            <span>
              {free} {pluralRu(free, "место свободно", "места свободно", "мест свободно")} из{" "}
              {family.max_members}
            </span>
            <span>оплата {family.payment_day}-го</span>
          </div>
        </section>

        {invite?.code ? (
          <section className="invite-owner-card family-created-invite" data-testid="family-created-invite">
            <div>
              <Typography as="span" variant="body" level={4} className="muted">
                {family.is_search_visible ? "Код приглашения" : "Код для вступления (приватная)"}
              </Typography>
              <Typography
                as="strong"
                variant="subtitle"
                level={2}
                data-testid="family-created-invite-code"
                style={{ fontSize: "24px", letterSpacing: "0.1em", marginTop: "4px" }}
              >
                {invite.code.length === 6
                  ? `${invite.code.slice(0, 3)} ${invite.code.slice(3)}`
                  : invite.code}
              </Typography>
              <Typography as="p" variant="body" level={3} className="muted" style={{ marginTop: "6px" }}>
                {family.is_search_visible
                  ? "Близкие могут ввести этот 6-значный код в поиске Маркета, чтобы сразу открыть карточку семьи."
                  : "Семья скрыта из общего Маркета. Отправьте этот код близким, чтобы они нашли семью через поиск."}
              </Typography>
            </div>
            <div className="row-actions" style={{ marginTop: "4px" }}>
              <AppButton
                type="button"
                variant="secondary"
                size="sm"
                data-testid="copy-created-invite-code"
                onClick={() => void handleCopyCode(invite.code)}
              >
                {copied ? "Скопировано ✓" : "Скопировать код"}
              </AppButton>
            </div>
          </section>
        ) : null}

        {chat ? (
          <FamilyChatConnect
            familyId={family.id}
            chat={chat}
            groupName={`SubsMarket · ${title}`}
          />
        ) : null}

        {nativeMainButton ? null : (
          <AppButton
            type="button"
            variant={connected || !chat ? "primary" : "secondary"}
            data-testid="family-created-done"
            onClick={onDone}
          >
            {connected || !chat ? "Готово" : "Подключить позже"}
          </AppButton>
        )}
        {!connected && chat ? (
          <small className="field-helper create-final-note">
            {family.is_search_visible
              ? "Без чата семья видна в маркете, но принять участников не получится. Подключить чат можно позже в «Мои»."
              : "Без чата принять участников не получится. Подключить чат можно позже в «Мои»."}
          </small>
        ) : null}
      </div>
    </Panel>
  );
}
