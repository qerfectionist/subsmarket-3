import { useState } from "react";
import { Button as WorldButton } from "@worldcoin/mini-apps-ui-kit-react";

import { FamilyCard } from "../components/families";
import { EmptyState, FamilyTypeSwitch, Panel } from "../components/layout";
import { FamilyListSkeleton } from "../components/skeleton";
import { serviceTitle } from "../format";
import { familyTypeLabels } from "../labels";
import type { Family, FamilyService, FamilyType } from "../types";

export function SearchScreen({
  familyType,
  services,
  typedServices,
  familyFilter,
  filteredFamilies,
  busy,
  isLoading,
  onChangeFamilyType,
  onChangeFamilyFilter,
  onRefresh,
  onImportCatalog,
  onOpenFamily,
  onOpenInvite,
  onCreateFamily,
  onCreateRequest
}: {
  familyType: FamilyType;
  services: FamilyService[];
  typedServices: FamilyService[];
  familyFilter: string;
  filteredFamilies: Family[];
  busy: string | null;
  isLoading?: boolean;
  onChangeFamilyType: (familyType: FamilyType) => void;
  onChangeFamilyFilter: (value: string) => void;
  onRefresh: () => void;
  onImportCatalog: () => void;
  onOpenFamily: (familyId: string) => void;
  onOpenInvite: (code: string) => void;
  onCreateFamily: (familyType: FamilyType) => void;
  onCreateRequest: (familyId: string) => void;
}) {
  const [inviteCode, setInviteCode] = useState("");
  const normalizedInviteCode = inviteCode.replace(/\D/g, "").slice(0, 8);
  const visibleFamiliesCount = filteredFamilies.length;
  const typeTitle = familyTypeLabels[familyType];

  return (
    <Panel
      title="Поиск семей"
      description="Выберите направление, откройте семью или отправьте заявку владельцу."
      action={
        services.length === 0 ? (
          <WorldButton
            type="button"
            size="sm"
            disabled={busy !== null}
            onClick={onImportCatalog}
          >
            Импортировать каталог
          </WorldButton>
        ) : undefined
      }
    >
      <section className="search-overview-card">
        <div>
          <span>
            {visibleFamiliesCount} семей · {typedServices.length} сервисов
          </span>
          <strong>{typeTitle}</strong>
        </div>
        <WorldButton
          type="button"
          className="search-create-button"
          size="sm"
          onClick={() => onCreateFamily(familyType)}
        >
          Создать
        </WorldButton>
      </section>

      <FamilyTypeSwitch value={familyType} onChange={onChangeFamilyType} />

      <div className="invite-code-card search-invite-card">
        <div>
          <strong>Есть код?</strong>
          <p className="muted">Введите 8 цифр, чтобы открыть конкретную семью.</p>
        </div>
        <div className="invite-toolbar">
          <input
            aria-label="Код приглашения"
            data-testid="invite-code-input"
            inputMode="numeric"
            maxLength={9}
            placeholder="4827 1936"
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
          />
          <WorldButton
            type="button"
            data-testid="open-invite-button"
            size="sm"
            disabled={busy !== null || normalizedInviteCode.length !== 8}
            onClick={() => onOpenInvite(normalizedInviteCode)}
          >
            Открыть
          </WorldButton>
        </div>
      </div>

      <div className="search-filter-card">
        <label>
          <span>Сервис</span>
          <select
            value={familyFilter}
            onChange={(event) => onChangeFamilyFilter(event.target.value)}
          >
            <option value="all">Все сервисы</option>
            {typedServices.map((item) => (
              <option key={item.id} value={item.id}>
                {serviceTitle(item)}
              </option>
            ))}
          </select>
        </label>
        <WorldButton type="button" size="sm" onClick={onRefresh} disabled={busy !== null}>
          Обновить
        </WorldButton>
      </div>

      {isLoading && filteredFamilies.length === 0 ? (
        <FamilyListSkeleton count={4} />
      ) : filteredFamilies.length === 0 ? (
        <EmptyState title="Пока нет семей">
          <span>
            По выбранному направлению сейчас нет свободных мест. Можно сменить сервис
            или открыть свою семью для участников.
          </span>
          <WorldButton
            type="button"
            data-testid="empty-create-family-button"
            fullWidth
            onClick={() => onCreateFamily(familyType)}
          >
            Создать семью
          </WorldButton>
        </EmptyState>
      ) : (
        <div className="card-grid">
          {filteredFamilies.map((family) => (
            <FamilyCard key={family.id} family={family}>
              <WorldButton
                type="button"
                variant="secondary"
                size="sm"
                data-testid="open-family-button"
                onClick={() => onOpenFamily(family.id)}
              >
                Подробнее
              </WorldButton>
              <WorldButton
                type="button"
                data-testid="send-request-button"
                size="sm"
                disabled={busy !== null}
                onClick={() => onCreateRequest(family.id)}
              >
                Отправить заявку
              </WorldButton>
            </FamilyCard>
          ))}
        </div>
      )}
    </Panel>
  );
}
