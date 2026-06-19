import { FamilyCard } from "../components/families";
import { EmptyState, FamilyTypeSwitch, Panel } from "../components/layout";
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
  onChangeFamilyType,
  onChangeFamilyFilter,
  onRefresh,
  onImportCatalog,
  onOpenFamily,
  onCreateFamily,
  onCreateRequest
}: {
  familyType: FamilyType;
  services: FamilyService[];
  typedServices: FamilyService[];
  familyFilter: string;
  filteredFamilies: Family[];
  busy: string | null;
  onChangeFamilyType: (familyType: FamilyType) => void;
  onChangeFamilyFilter: (value: string) => void;
  onRefresh: () => void;
  onImportCatalog: () => void;
  onOpenFamily: (familyId: string) => void;
  onCreateFamily: (familyType: FamilyType) => void;
  onCreateRequest: (familyId: string) => void;
}) {
  return (
    <Panel
      title={`Найти семью: ${familyTypeLabels[familyType].toLowerCase()}`}
      description="В поиске показываются только активные семьи со свободными местами."
      action={
        services.length === 0 ? (
          <button type="button" disabled={busy !== null} onClick={onImportCatalog}>
            Импортировать каталог
          </button>
        ) : undefined
      }
    >
      <FamilyTypeSwitch value={familyType} onChange={onChangeFamilyType} />
      <div className="toolbar">
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
        <button type="button" onClick={onRefresh} disabled={busy !== null}>
          Обновить
        </button>
      </div>
      {filteredFamilies.length === 0 ? (
        <EmptyState title="Пока нет доступных семей">
          <span>
            В этом разделе пока нет доступных семей. Можно создать первую семью
            или попробовать другой сервис.
          </span>
          <div className="empty-state-points" aria-label="Почему список может быть пустым">
            <span>
              <b>1</b>
              Заполненные семьи скрываются из поиска автоматически.
            </span>
            <span>
              <b>2</b>
              После отказа эта семья больше не будет раздражать повторной заявкой.
            </span>
            <span>
              <b>3</b>
              Можно создать свою семью, если нужного варианта пока нет.
            </span>
          </div>
          <button
            type="button"
            data-testid="empty-create-family-button"
            onClick={() => onCreateFamily(familyType)}
          >
            Создать семью
          </button>
        </EmptyState>
      ) : (
        <div className="card-grid">
          {filteredFamilies.map((family) => (
            <FamilyCard key={family.id} family={family}>
              <button
                type="button"
                className="secondary"
                data-testid="open-family-button"
                onClick={() => onOpenFamily(family.id)}
              >
                Подробнее
              </button>
              <button
                type="button"
                data-testid="send-request-button"
                disabled={busy !== null}
                onClick={() => onCreateRequest(family.id)}
              >
                Отправить заявку
              </button>
            </FamilyCard>
          ))}
        </div>
      )}
    </Panel>
  );
}
