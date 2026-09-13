import { Icon, type IconProps } from "@iconify/react";
import addDuotone from "@iconify-icons/solar/add-bold-duotone";
import altArrowLeftDuotone from "@iconify-icons/solar/alt-arrow-left-bold-duotone";
import arrowLeftDuotone from "@iconify-icons/solar/arrow-left-bold-duotone";
import bellRingDuotone from "@iconify-icons/solar/bell-ring-bold-duotone";
import bookDuotone from "@iconify-icons/solar/book-bold-duotone";
import calendarDuotone from "@iconify-icons/solar/calendar-bold-duotone";
import checkCircleDuotone from "@iconify-icons/solar/check-circle-bold-duotone";
import checklistDuotone from "@iconify-icons/solar/checklist-bold-duotone";
import chatRoundLineDuotone from "@iconify-icons/solar/chat-round-line-bold-duotone";
import clipboardListDuotone from "@iconify-icons/solar/clipboard-list-bold-duotone";
import cloudDuotone from "@iconify-icons/solar/cloud-bold-duotone";
import closeDuotone from "@iconify-icons/solar/close-bold-duotone";
import crownDuotone from "@iconify-icons/solar/crown-bold-duotone";
import dangerCircleDuotone from "@iconify-icons/solar/danger-circle-bold-duotone";
import filterDuotone from "@iconify-icons/solar/filter-bold-duotone";
import globalDuotone from "@iconify-icons/solar/global-bold-duotone";
import iPhoneDuotone from "@iconify-icons/solar/i-phone-bold-duotone";
import infoCircleDuotone from "@iconify-icons/solar/info-circle-bold-duotone";
import keyDuotone from "@iconify-icons/solar/key-bold-duotone";
import magnifierDuotone from "@iconify-icons/solar/magnifier-bold-duotone";
import musicNoteDuotone from "@iconify-icons/solar/music-note-bold-duotone";
import pauseCircleDuotone from "@iconify-icons/solar/pause-circle-bold-duotone";
import penDuotone from "@iconify-icons/solar/pen-bold-duotone";
import plainDuotone from "@iconify-icons/solar/plain-bold-duotone";
import playCircleDuotone from "@iconify-icons/solar/play-circle-bold-duotone";
import radioDuotone from "@iconify-icons/solar/radio-bold-duotone";
import refreshDuotone from "@iconify-icons/solar/refresh-bold-duotone";
import roundSortVerticalDuotone from "@iconify-icons/solar/round-sort-vertical-bold-duotone";
import shieldCheckDuotone from "@iconify-icons/solar/shield-check-bold-duotone";
import sortDuotone from "@iconify-icons/solar/sort-bold-duotone";
import tuning2Duotone from "@iconify-icons/solar/tuning-2-bold-duotone";
import userCircleDuotone from "@iconify-icons/solar/user-circle-bold-duotone";
import userPlusDuotone from "@iconify-icons/solar/user-plus-bold-duotone";
import usersGroupTwoRoundedDuotone from "@iconify-icons/solar/users-group-two-rounded-bold-duotone";
import widget2Duotone from "@iconify-icons/solar/widget-2-bold-duotone";
import clockCircleDuotone from "@iconify-icons/solar/clock-circle-bold-duotone";

const SYSTEM_SYMBOLS = {
  "antenna.radiowaves.left.and.right": radioDuotone,
  "arrow.clockwise": refreshDuotone,
  "arrow.left": arrowLeftDuotone,
  "bell.badge": bellRingDuotone,
  book: bookDuotone,
  calendar: calendarDuotone,
  checkmark: checkCircleDuotone,
  "checkmark.circle": checkCircleDuotone,
  "checkmark.shield": shieldCheckDuotone,
  checklist: checklistDuotone,
  "clipboard.list": clipboardListDuotone,
  "chevron.backward": altArrowLeftDuotone,
  clock: clockCircleDuotone,
  cloud: cloudDuotone,
  crown: crownDuotone,
  "exclamationmark.circle": dangerCircleDuotone,
  globe: globalDuotone,
  "info.circle": infoCircleDuotone,
  iphone: iPhoneDuotone,
  key: keyDuotone,
  "line.3.horizontal.decrease.circle": filterDuotone,
  "line.3.horizontal.decrease": filterDuotone,
  magnifyingglass: magnifierDuotone,
  message: chatRoundLineDuotone,
  "music.note": musicNoteDuotone,
  paperplane: plainDuotone,
  "pause.circle": pauseCircleDuotone,
  "person.2": usersGroupTwoRoundedDuotone,
  "person.2.badge.plus": userPlusDuotone,
  "person.crop.circle": userCircleDuotone,
  "person.crop.circle.fill": userCircleDuotone,
  pencil: penDuotone,
  "play.rectangle": playCircleDuotone,
  plus: addDuotone,
  "square.grid.2x2": widget2Duotone,
  "square.grid.2x2.fill": widget2Duotone,
  "round-sort-vertical": roundSortVerticalDuotone,
  sort: sortDuotone,
  tuning: tuning2Duotone,
  xmark: closeDuotone
} as const;

export type SystemSymbolName = keyof typeof SYSTEM_SYMBOLS;

type SystemSymbolSize = "xs" | "sm" | "md" | "lg" | "xl" | number;

const SYSTEM_SYMBOL_SIZES = {
  xs: 16,
  sm: 20,
  md: 22,
  lg: 24,
  xl: 32
} as const;

type SystemSymbolProps = Omit<IconProps, "icon" | "width" | "height"> & {
  name: SystemSymbolName;
  size?: SystemSymbolSize;
};

export function SystemSymbol({ name, className, size = "lg", ...props }: SystemSymbolProps) {
  const resolvedSize = typeof size === "number" ? size : SYSTEM_SYMBOL_SIZES[size];

  return (
    <Icon
      {...props}
      icon={SYSTEM_SYMBOLS[name]}
      width={resolvedSize}
      height={resolvedSize}
      aria-hidden="true"
      className={["sm-system-symbol", className ?? ""].filter(Boolean).join(" ")}
    />
  );
}
