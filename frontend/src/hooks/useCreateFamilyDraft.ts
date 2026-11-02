import { useEffect, useState } from "react";
import type { CreateStep } from "../components/families/createFamilyForm";
import { PAYOUT_START, type PayoutProgress } from "../components/families/createPayoutParts";
import type { FamilyCreate, FamilyType } from "../types";

/**
 * Families left half-made, kept on the device so an accidental exit (another
 * tab, the back gesture, closing the Mini App) loses nothing: the form, the
 * step it was on and how far «Выплата» was walked. At most three, each kept
 * thirty days, so they do not pile up.
 */
export type CreateFamilyDraft = {
  id: string;
  form: FamilyCreate;
  familyType: FamilyType;
  step: CreateStep;
  progress: PayoutProgress;
  savedAt: number;
};

/** Where the wizard is: reported by the create screen, saved with the form. */
export type CreateWizardState = { step: CreateStep; progress: PayoutProgress };

export const WIZARD_START: CreateWizardState = { step: "service", progress: PAYOUT_START };

export const MAX_DRAFTS = 3;
export const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const STEPS: CreateStep[] = ["service", "terms", "payout"];

// One list per Telegram user, so switching accounts on a device mixes nothing.
const storageKey = (userId: string) => `subsmarket.createFamilyDrafts.${userId}`;

export const newDraftId = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function isDraft(value: unknown): value is CreateFamilyDraft {
  const draft = value as CreateFamilyDraft;
  return Boolean(draft?.id && draft.form?.service_id && STEPS.includes(draft.step));
}

function readDrafts(userId: string): CreateFamilyDraft[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const list: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    const now = Date.now();
    return list
      .filter(isDraft)
      .filter((draft) => now - draft.savedAt < DRAFT_TTL_MS)
      .map((draft) => ({ ...draft, progress: draft.progress ?? PAYOUT_START }))
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(0, MAX_DRAFTS);
  } catch {
    return [];
  }
}

function writeDrafts(userId: string, drafts: CreateFamilyDraft[]) {
  try {
    if (drafts.length > 0) localStorage.setItem(storageKey(userId), JSON.stringify(drafts));
    else localStorage.removeItem(storageKey(userId));
  } catch {
    // Storage can be off (private mode, a full quota): the form still works, it just is not kept.
  }
}

/**
 * Keeps the open family form as draft `draftId` once a service is picked, and
 * gives back all drafts, newest first, for the «Создать» menu.
 */
export function useCreateFamilyDrafts({
  userId,
  active,
  draftId,
  form,
  familyType,
  wizard
}: {
  userId: string | null;
  /** The family form is on screen. */
  active: boolean;
  /** The draft the open form writes to. */
  draftId: string;
  form: FamilyCreate;
  familyType: FamilyType;
  wizard: CreateWizardState;
}) {
  const [drafts, setDrafts] = useState<CreateFamilyDraft[]>([]);

  useEffect(() => {
    setDrafts(userId ? readDrafts(userId) : []);
  }, [userId]);

  useEffect(() => {
    // Nothing worth keeping until a service is picked.
    if (!userId || !active || !form.service_id) return;
    const current: CreateFamilyDraft = { id: draftId, form, familyType, ...wizard, savedAt: Date.now() };
    // The newest first; a fourth pushes the oldest out.
    const next = [current, ...readDrafts(userId).filter((draft) => draft.id !== draftId)].slice(0, MAX_DRAFTS);
    writeDrafts(userId, next);
    setDrafts(next);
  }, [userId, active, draftId, form, familyType, wizard]);

  function remove(id: string) {
    if (!userId) return;
    const next = readDrafts(userId).filter((draft) => draft.id !== id);
    writeDrafts(userId, next);
    setDrafts(next);
  }

  /** Undo of a delete: the draft comes back in its place by date. */
  function restore(draft: CreateFamilyDraft) {
    if (!userId) return;
    const next = [draft, ...readDrafts(userId).filter((item) => item.id !== draft.id)]
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(0, MAX_DRAFTS);
    writeDrafts(userId, next);
    setDrafts(next);
  }

  return { drafts, remove, restore };
}
