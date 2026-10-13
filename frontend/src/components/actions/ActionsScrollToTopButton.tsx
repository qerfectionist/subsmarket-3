import type { RefObject } from "react";
import { ScrollToTopButton } from "../ScrollToTopButton";

export interface ActionsScrollToTopButtonProps {
  onClick?: () => void;
  containerRef?: RefObject<HTMLDivElement | null>;
  label?: string;
  testId?: string;
}

export function ActionsScrollToTopButton({
  onClick,
  containerRef,
  label = "Наверх",
  testId = "actions-scroll-to-top-btn"
}: ActionsScrollToTopButtonProps) {
  return (
    <ScrollToTopButton
      onClick={onClick}
      containerRef={containerRef}
      label={label}
      testId={testId}
      className="actions-scroll-to-top-wrap"
    />
  );
}
