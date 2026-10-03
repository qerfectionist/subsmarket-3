import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../ui";
import { triggerTelegramImpact, triggerTelegramSelection } from "../../telegram";
import type {
  Family,
  OwnerFamilyRequest,
  AccountRequest,
  MarketplaceListingRequest,
  FamilyRequest
} from "../../types";

export {
  DEV_TEST_CARDS_STORAGE_KEY,
  type DevTestCardsState
} from "../../utils/devCardsStore";
import {
  DEV_TEST_CARDS_STORAGE_KEY,
  DEV_CARDS_UPDATE_EVENT,
  loadDevCards,
  notifyDevCardsUpdated,
  type DevTestCardsState
} from "../../utils/devCardsStore";
import type { ActionsTab } from "./ActionsScopePager";
import type { ActionsCategoryFilter, ActionsStatusFilter } from "./actionsFilterTypes";
import {
  createRandomDevCandidate,
  createRandomDevAccountRequest,
  createRandomDevGbRequest,
  createRandomDevBuyerFamilyRequest
} from "../../utils/devTestCards";
import { cleanAllCardsApi, clearArchiveApi, resetAndSeedAllApi } from "../../api/dev";


export interface UseActionsDevCardsOptions {
  actionsTab: ActionsTab;
  actionsCategory: ActionsCategoryFilter;
  setActionsCategory: (cat: ActionsCategoryFilter) => void;
  setActionsStatus: (status: ActionsStatusFilter) => void;
}

export function useActionsDevCards({
  actionsTab,
  actionsCategory,
  setActionsCategory,
  setActionsStatus
}: UseActionsDevCardsOptions) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [devCards, setDevCardsState] = useState<DevTestCardsState>(() => loadDevCards());

  useEffect(() => {
    const handleUpdate = () => {
      setDevCardsState(loadDevCards());
    };
    window.addEventListener(DEV_CARDS_UPDATE_EVENT, handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener(DEV_CARDS_UPDATE_EVENT, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const setDevCards = (action: React.SetStateAction<DevTestCardsState>) => {
    setDevCardsState((prev) => {
      const next = typeof action === "function" ? action(prev) : action;
      notifyDevCardsUpdated(next);
      return next;
    });
  };

  const [timerPrototype, setTimerPrototype] = useState<1 | 2 | 3 | 4>(() => {
    if (typeof window === "undefined") return 1;
    try {
      const saved = localStorage.getItem("sm_timer_proto");
      if (saved && ["1", "2", "3", "4"].includes(saved)) {
        return Number(saved) as 1 | 2 | 3 | 4;
      }
    } catch {
      // ignore
    }
    return 1;
  });

  const handleSelectTimerPrototype = (proto: 1 | 2 | 3 | 4) => {
    setTimerPrototype(proto);
    try {
      localStorage.setItem("sm_timer_proto", String(proto));
    } catch {
      // ignore
    }
    triggerTelegramSelection();
  };

  const devCardsTotalCount =
    devCards.candidates.length +
    devCards.sellerAccounts.length +
    devCards.buyerAccounts.length +
    devCards.sellerGb.length +
    devCards.buyerGb.length +
    devCards.buyerFamilies.length;

  function handleAddDevFamily() {
    triggerTelegramImpact("light");
    setActionsStatus("all");
    if (actionsCategory !== "all" && actionsCategory !== "families") setActionsCategory("all");
    if (actionsTab === "outbox") {
      const item = createRandomDevBuyerFamilyRequest();
      setDevCards((prev) => ({ ...prev, buyerFamilies: [item, ...prev.buyerFamilies] }));
      toast.success({ title: `Добавлена заявка: ${item.service_name}` });
    } else {
      const { family, request } = createRandomDevCandidate();
      setDevCards((prev) => ({ ...prev, candidates: [{ family, request }, ...prev.candidates] }));
      toast.success({ title: `Добавлен кандидат: ${family.service_name}` });
    }
  }

  function handleAddDevAccount() {
    triggerTelegramImpact("light");
    setActionsStatus("all");
    if (actionsCategory !== "all" && actionsCategory !== "accounts") setActionsCategory("all");
    const role = actionsTab === "outbox" ? "buyer" : "seller";
    const item = createRandomDevAccountRequest(role);
    if (role === "seller") {
      setDevCards((prev) => ({ ...prev, sellerAccounts: [item, ...prev.sellerAccounts] }));
    } else {
      setDevCards((prev) => ({ ...prev, buyerAccounts: [item, ...prev.buyerAccounts] }));
    }
    toast.success({ title: `Добавлен аккаунт: ${item.service_name}` });
  }

  function handleAddDevGb() {
    triggerTelegramImpact("light");
    setActionsStatus("all");
    if (actionsCategory !== "all" && actionsCategory !== "gigabytes") setActionsCategory("all");
    const role = actionsTab === "outbox" ? "buyer" : "seller";
    const item = createRandomDevGbRequest(role);
    if (role === "seller") {
      setDevCards((prev) => ({ ...prev, sellerGb: [item, ...prev.sellerGb] }));
    } else {
      setDevCards((prev) => ({ ...prev, buyerGb: [item, ...prev.buyerGb] }));
    }
    toast.success({ title: `Добавлен трафик: ${item.operator_name}` });
  }

  function handleAddAllDevCategories() {
    triggerTelegramImpact("medium");
    setActionsCategory("all");
    setActionsStatus("all");
    if (actionsTab === "outbox") {
      setDevCards((prev) => ({
        ...prev,
        buyerFamilies: [createRandomDevBuyerFamilyRequest(), ...prev.buyerFamilies],
        buyerAccounts: [createRandomDevAccountRequest("buyer"), ...prev.buyerAccounts],
        buyerGb: [createRandomDevGbRequest("buyer"), ...prev.buyerGb]
      }));
    } else {
      const { family, request } = createRandomDevCandidate();
      setDevCards((prev) => ({
        ...prev,
        candidates: [{ family, request }, ...prev.candidates],
        sellerAccounts: [createRandomDevAccountRequest("seller"), ...prev.sellerAccounts],
        sellerGb: [createRandomDevGbRequest("seller"), ...prev.sellerGb]
      }));
    }
    toast.success({ title: "Добавлены все 3 категории!" });
  }

  async function handleClearAllDevCards() {
    triggerTelegramImpact("medium");
    setDevCards({ candidates: [], sellerAccounts: [], buyerAccounts: [], sellerGb: [], buyerGb: [], buyerFamilies: [] });
    try {
      localStorage.removeItem(DEV_TEST_CARDS_STORAGE_KEY);
    } catch {
      // ignore
    }
    try {
      await cleanAllCardsApi();
      await queryClient.invalidateQueries();
    } catch {
      // dev API might not be available in non-dev
    }
    toast.info({ title: "Все тестовые карточки и архив очищены" });
  }

  async function handleClearArchive() {
    triggerTelegramImpact("medium");
    try {
      await clearArchiveApi();
      await queryClient.invalidateQueries();
      toast.success({ title: "Архив успешно очищен" });
    } catch {
      toast.error({ title: "Не удалось очистить архив" });
    }
  }

  async function handleResetAndSeedAll() {
    triggerTelegramImpact("medium");
    setDevCards({ candidates: [], sellerAccounts: [], buyerAccounts: [], sellerGb: [], buyerGb: [], buyerFamilies: [] });
    try {
      localStorage.removeItem(DEV_TEST_CARDS_STORAGE_KEY);
    } catch {
      // ignore
    }
    try {
      await resetAndSeedAllApi();
      await queryClient.invalidateQueries();
      toast.success({ title: "Новые карточки добавлены, архив очищен" });
    } catch {
      toast.error({ title: "Не удалось обновить карточки" });
    }
  }

  return {
    devCards,
    setDevCards,
    timerPrototype,
    handleSelectTimerPrototype,
    devCardsTotalCount,
    handleAddDevFamily,
    handleAddDevAccount,
    handleAddDevGb,
    handleAddAllDevCategories,
    handleClearAllDevCards,
    handleClearArchive,
    handleResetAndSeedAll
  };
}
