import { useEffect, useState } from "react";
import { countDevCards, DEV_CARDS_UPDATE_EVENT } from "../utils/devCardsStore";
import { DEV_OPEN_CONSTRUCTOR_EVENT } from "../components/DevControls";

export function useDevCardsModal() {
  const [isDevCardsModalOpen, setIsDevCardsModalOpen] = useState(false);
  const [devCardsTotal, setDevCardsTotal] = useState(() =>
    import.meta.env.DEV ? countDevCards().total : 0
  );

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const handleCardsUpdate = () => {
      setDevCardsTotal(countDevCards().total);
    };
    const handleOpenModal = () => {
      setIsDevCardsModalOpen(true);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === "KeyD" || e.key === "D")) {
        e.preventDefault();
        setIsDevCardsModalOpen((prev) => !prev);
      }
    };
    window.addEventListener(DEV_CARDS_UPDATE_EVENT, handleCardsUpdate);
    window.addEventListener(DEV_OPEN_CONSTRUCTOR_EVENT, handleOpenModal);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener(DEV_CARDS_UPDATE_EVENT, handleCardsUpdate);
      window.removeEventListener(DEV_OPEN_CONSTRUCTOR_EVENT, handleOpenModal);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return {
    isDevCardsModalOpen,
    setIsDevCardsModalOpen,
    devCardsTotal
  };
}
