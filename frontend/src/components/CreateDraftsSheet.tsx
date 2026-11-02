import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from "react";
import { createPortal } from "react-dom";
import { ServiceLogo } from "./branding";
import { SystemSymbol } from "./SystemSymbol";
import { triggerTelegramSelection } from "../telegram";
import { calculatePreviewShare } from "./families/createFamilyForm";
import { DRAFT_TTL_MS, MAX_DRAFTS, type CreateFamilyDraft } from "../hooks/useCreateFamilyDraft";
import type { FamilyService } from "../types";

const DAY = 86_400_000;
/** How long the sheet takes to slide away; matches the CSS. */
const SHEET_EXIT_MS = 240;
/** How far a row slides left to show the bin. */
const SWIPE_OPEN = 56;

/** What is left to fill in, in the person's words (the payout step asks for the requisites). */
const LEFT: Record<CreateFamilyDraft["step"], string> = {
  service: "Нужны цена и реквизиты",
  terms: "Нужны цена и реквизиты",
  payout: "Нужны реквизиты"
};

const placesWord = (count: number) => (count >= 2 && count <= 4 ? "места" : "мест");

/** The pencil and the count on a kind row of «Создать»: drafts waiting there. */
export function CreateDraftsCount({ count }: { count: number }) {
  return (
    <span className="create-drafts-count" data-testid="create-drafts-count" aria-label={`Черновиков: ${count}`}>
      <SystemSymbol name="pencil" size={12} />
      {count}
    </span>
  );
}

/**
 * One draft: the service and what is left on the left, the price and places
 * that tell two drafts of one service apart on the right. Swiped left the card
 * narrows from its right edge and a round bin grows in the space it frees.
 */
function DraftRow({
  draft,
  service,
  onResume,
  onDiscard
}: {
  draft: CreateFamilyDraft;
  service: FamilyService;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const drag = useRef<{ x: number; y: number; start: number; moved: boolean } | null>(null);
  // The click that ends a swipe is not a tap on the row.
  const swiped = useRef(false);
  const share = calculatePreviewShare(draft.form.total_price_kzt, draft.form.max_members);
  const daysLeft = Math.ceil((DRAFT_TTL_MS - (Date.now() - draft.savedAt)) / DAY);
  // Said only when it matters: a draft about to be dropped.
  const expiring = daysLeft <= 5;

  function onPointerDown(event: ReactPointerEvent) {
    drag.current = { x: event.clientX, y: event.clientY, start: offset, moved: false };
  }
  function onPointerMove(event: ReactPointerEvent) {
    const current = drag.current;
    if (!current) return;
    const dx = event.clientX - current.x;
    if (!current.moved && Math.abs(dx) < 8) return;
    if (!current.moved && Math.abs(event.clientY - current.y) > Math.abs(dx)) {
      drag.current = null;
      return;
    }
    current.moved = true;
    setOffset(Math.min(0, Math.max(-SWIPE_OPEN - 12, current.start + dx)));
  }
  function onPointerUp() {
    const current = drag.current;
    drag.current = null;
    if (!current?.moved) return;
    swiped.current = true;
    setOffset((value) => (value < -SWIPE_OPEN / 2 ? -SWIPE_OPEN : 0));
  }

  return (
    <div
      className="create-drafts-row"
      data-open={offset !== 0 || undefined}
      data-dragging={drag.current?.moved || undefined}
      // 0 → 1 as the card gives way: the bin grows and shows in step with it.
      style={{ "--swipe": Math.min(1, -offset / SWIPE_OPEN), "--swipe-px": `${-offset}px` } as CSSProperties}
    >
      <button
        type="button"
        className="create-drafts-delete"
        data-testid="create-draft-discard"
        aria-label={`Удалить черновик ${service.name}`}
        tabIndex={offset === -SWIPE_OPEN ? 0 : -1}
        onClick={onDiscard}
      >
        <SystemSymbol name="trash" size={20} />
      </button>
      <button
        type="button"
        className="create-drafts-open"
        data-testid="create-draft-resume"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={(event) => {
          if (swiped.current) {
            swiped.current = false;
            return;
          }
          // A tap on a swiped-open row closes it instead of opening the draft.
          if (offset !== 0) {
            event.preventDefault();
            setOffset(0);
            return;
          }
          onResume();
        }}
      >
        <span className="create-drafts-logo" aria-hidden="true">
          <ServiceLogo
            serviceSlug={service.slug}
            serviceName={service.name}
            familyType={service.family_type === "tariff" ? "tariff" : "subscription"}
            size={34}
          />
        </span>
        <span className="create-row-copy">
          <strong>{service.name}</strong>
          <span>{LEFT[draft.step]}</span>
          {expiring ? <span className="create-drafts-expiring">Удалится через {daysLeft} дн.</span> : null}
        </span>
        <span className="create-drafts-price">
          <strong>{share.toLocaleString("ru-RU")} ₸</strong>
          <span>
            {draft.form.max_members} {placesWord(draft.form.max_members)}
          </span>
        </span>
      </button>
    </div>
  );
}

/**
 * Tapping a kind that has drafts: «Черновики», the drafts as one group (the
 * rows are the main action), and «Создать новую» as the quiet second one.
 * Slides up and away; pulled down by its top or Esc closes it too.
 */
export function CreateDraftsSheet({
  drafts,
  totalDrafts,
  services,
  onResume,
  onDiscard,
  onCreateNew,
  onClose
}: {
  drafts: CreateFamilyDraft[];
  /** All drafts of every kind: at the limit a new one replaces the oldest. */
  totalDrafts: number;
  services: FamilyService[];
  onResume: (draft: CreateFamilyDraft) => void;
  onDiscard: (draft: CreateFamilyDraft) => void;
  onCreateNew: () => void;
  onClose: () => void;
}) {
  const [closing, setClosing] = useState(false);
  const [pull, setPull] = useState(0);
  const pullStart = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => {
    setClosing(true);
    window.setTimeout(onClose, SHEET_EXIT_MS);
  }, [onClose]);

  // The last one deleted: nothing left to choose from, so the sheet goes.
  useEffect(() => {
    if (drafts.length === 0) close();
  }, [drafts.length, close]);

  // Focus stays in the sheet while it is open; Esc closes it.
  useEffect(() => {
    sheetRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  return createPortal(
    <div className="account-sheet-backdrop create-drafts-backdrop" data-closing={closing || undefined} onClick={close}>
      <div
        ref={sheetRef}
        tabIndex={-1}
        className="account-sheet create-drafts-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-drafts-title"
        data-testid="create-drafts-sheet"
        style={pull > 0 ? { transform: `translateY(${pull}px)`, transition: "none" } : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        {/* The top strip is the grip: pulled down far enough, the sheet closes. */}
        <div
          className="create-drafts-grip"
          onPointerDown={(event) => {
            pullStart.current = event.clientY;
            (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (pullStart.current !== null) setPull(Math.max(0, event.clientY - pullStart.current));
          }}
          onPointerUp={() => {
            pullStart.current = null;
            if (pull > 90) close();
            setPull(0);
          }}
          onPointerCancel={() => {
            pullStart.current = null;
            setPull(0);
          }}
        >
          <div className="account-sheet-handle" aria-hidden />
          <h2 id="create-drafts-title">Черновики</h2>
        </div>
        <div className="create-drafts-list">
          {drafts.map((draft) => {
            const service = services.find((item) => item.id === draft.form.service_id);
            return service ? (
              <DraftRow
                key={draft.id}
                draft={draft}
                service={service}
                onResume={() => {
                  triggerTelegramSelection();
                  onResume(draft);
                }}
                onDiscard={() => onDiscard(draft)}
              />
            ) : null;
          })}
        </div>
        <button type="button" className="create-drafts-new" data-testid="create-drafts-new" onClick={onCreateNew}>
          <SystemSymbol name="plus" size={16} />
          Создать новую
        </button>
        {totalDrafts >= MAX_DRAFTS ? (
          <small className="create-drafts-note">Новая заменит самый старый черновик</small>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

/** «Черновик удалён · Вернуть»: a few seconds to take a delete back. */
export function CreateDraftUndo({ onUndo, onDone }: { onUndo: () => void; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 5000);
    return () => window.clearTimeout(timer);
  }, [onDone]);
  return createPortal(
    <div className="create-draft-undo" role="status" data-testid="create-draft-undo">
      <span>Черновик удалён</span>
      <button type="button" data-testid="create-draft-undo-button" onClick={onUndo}>
        Вернуть
      </button>
    </div>,
    document.body
  );
}
