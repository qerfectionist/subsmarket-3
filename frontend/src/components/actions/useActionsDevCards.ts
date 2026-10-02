import { useEffect, useState } from "react";
import { useToast } from "../ui";
import { triggerTelegramImpact, triggerTelegramSelection } from "../../telegram";
import {
  DEV_TEST_CARDS_STORAGE_KEY,
  type DevTestCardsState
} from "./ActionsDevConstructor";
import type { ActionsTab } from "./ActionsScopePager";
import type { ActionsCategoryFilter, ActionsStatusFilter } from "./actionsFilterTypes";
import {
  createRandomDevCandidate,
  createRandomDevAccountRequest,
  createRandomDevGbRequest,
  createRandomDevBuyerFamilyRequest
} from "../../utils/devTestCards";

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

  const [devCards, setDevCards] = useState<DevTestCardsState>(() => {
    if (typeof window === "undefined") {
      return { candidates: [], sellerAccounts: [], buyerAccounts: [], sellerGb: [], buyerGb: [], buyerFamilies: [] };
    }
    try {
      const raw = localStorage.getItem(DEV_TEST_CARDS_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return { candidates: [], sellerAccounts: [], buyerAccounts: [], sellerGb: [], buyerGb: [], buyerFamilies: [] };
  });

  useEffect(() => {
    try {
      localStorage.setItem(DEV_TEST_CARDS_STORAGE_KEY, JSON.stringify(devCards));
    } catch {
      // ignore
    }
  }, [devCards]);

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

  function handleClearAllDevCards() {
    triggerTelegramImpact("medium");
    setDevCards({ candidates: [], sellerAccounts: [], buyerAccounts: [], sellerGb: [], buyerGb: [], buyerFamilies: [] });
    toast.info({ title: "Все тестовые карточки удалены" });
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
    handleClearAllDevCards
  };
}
