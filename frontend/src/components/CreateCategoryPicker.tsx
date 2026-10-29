import { useRef, type CSSProperties, type ReactNode } from "react";
import { useSegmentSwitchSwipe } from "../hooks/useSegmentSwitchSwipe";
import { Button as AppButton } from "./ui";
import { Panel } from "./layout";

export type CreateCategory = "subscription" | "tariff" | "accounts" | "gigabytes";

const CATEGORIES: CreateCategory[] = ["subscription", "tariff", "accounts", "gigabytes"];

const LABELS: Record<CreateCategory, string> = {
  subscription: "Подписки",
  tariff: "Тарифы",
  accounts: "Аккаунты",
  gigabytes: "ГБ"
};

/**
 * What the person creates. The same glass slider as on «Мои» (product-scope-switch),
 * with a fourth segment for operator tariffs.
 */
export function CreateScopeSwitch({
  value,
  onChange
}: {
  value: CreateCategory;
  onChange: (value: CreateCategory) => void;
}) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const switchSwipe = useSegmentSwitchSwipe<CreateCategory>({
    items: CATEGORIES,
    value,
    onChange,
    onPositionChange: (position, dragging) => {
      const node = innerRef.current;
      if (!node) return;
      node.style.setProperty("--scope-position", String(position));
      if (dragging) node.dataset.scopeDragging = "true";
      else delete node.dataset.scopeDragging;
    }
  });
  const style = { "--scope-position": CATEGORIES.indexOf(value) } as CSSProperties;

  return (
    <div
      ref={(node) => {
        innerRef.current = node;
        switchSwipe.switchRef.current = node;
      }}
      className="product-scope-switch create-scope-switch"
      role="group"
      aria-label="Что создаём"
      style={style}
      {...switchSwipe.handlers}
    >
      {CATEGORIES.map((category) => (
        <AppButton
          key={category}
          type="button"
          size="sm"
          data-testid={`create-kind-${category}`}
          aria-pressed={value === category}
          variant={value === category ? "primary" : "tertiary"}
          onClick={() => {
            if (value !== category) onChange(category);
          }}
        >
          {LABELS[category]}
        </AppButton>
      ))}
    </div>
  );
}

/** «Создать»: the same header and slider as «Мои»; the chosen form goes below. */
export function CreateShell({
  kind,
  onChangeKind,
  title = "Создать",
  showSwitch = true,
  testId,
  children
}: {
  kind: CreateCategory;
  onChangeKind: (value: CreateCategory) => void;
  title?: string;
  showSwitch?: boolean;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <div className="create-screen" data-testid={testId}>
      <Panel title={title}>
        {showSwitch ? (
          <div className="create-screen-filters">
            <CreateScopeSwitch value={kind} onChange={onChangeKind} />
          </div>
        ) : null}
        {children}
      </Panel>
    </div>
  );
}
