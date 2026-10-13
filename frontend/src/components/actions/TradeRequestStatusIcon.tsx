import { SystemSymbol } from "../SystemSymbol";

export interface TradeRequestStatusIconProps {
  status?: string;
  className?: string;
}

export function TradeRequestStatusIcon({ status, className }: TradeRequestStatusIconProps) {
  const iconClass = className || "my-trade-request-status-icon";

  switch (status) {
    case "expired":
    case "pending":
      return <SystemSymbol name="clock" size={12} className={className || "my-trade-request-clock-icon"} />;
    case "rejected":
    case "cancelled":
      return <SystemSymbol name="xmark.circle" size={12} className={iconClass} />;
    case "accepted":
    case "approved":
    case "successful":
    case "closed":
    case "paid":
    case "active":
      return <SystemSymbol name="checkmark.circle" size={12} className={iconClass} />;
    default:
      return <SystemSymbol name="clock" size={12} className={iconClass} />;
  }
}
