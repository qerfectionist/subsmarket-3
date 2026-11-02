import { useState } from "react";
import { Button as AppButton } from "../components/ui";
import { Panel } from "../components/layout";
import { ServiceLogo } from "../components/branding";
import { FamilyChatConnect } from "../components/families/FamilyChatPanel";
import { formatKzt, pluralRu } from "../components/families/createFamilyForm";
import { familyTitle } from "../format";
import { useTelegramBackButton, useTelegramMainButton } from "../hooks/useTelegramAppEffects";
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

  useTelegramBackButton(true, onDone);
  useTelegramMainButton({
    visible: nativeMainButton,
    label: connected || !chat ? "Готово" : "Подключить позже",
    onClick: onDone,
    isPending: false,
    disabled: false
  });

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
