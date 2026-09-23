import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ChangeEventHandler,
  type ComponentPropsWithoutRef,
  type ElementType,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type PointerEventHandler,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes
} from "react";
import { gsap } from "gsap";
import { SystemSymbol } from "./SystemSymbol";

type ButtonVariant = "primary" | "secondary" | "tertiary";
type ButtonSize = "md" | "sm" | "icon";

export type ButtonProps = Omit<ComponentPropsWithoutRef<"button">, "className"> & {
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  fullWidth = false,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={[
        "ui-button",
        `ui-button-${variant}`,
        `ui-button-${size}`,
        fullWidth ? "ui-button-full" : "",
        className ?? ""
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

type FieldProps = {
  label?: ReactNode;
  error?: boolean;
  className?: string;
};

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> &
  FieldProps;

export function Input({ label, error = false, className, ...props }: InputProps) {
  const input = (
    <input
      {...props}
      className={["input", error ? "input-error" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      aria-invalid={error || undefined}
    />
  );

  return label ? <label className="ui-field">{label && <span>{label}</span>}{input}</label> : input;
}

export type TextAreaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "className"
> & FieldProps;

export function TextArea({ label, error = false, className, ...props }: TextAreaProps) {
  const textarea = (
    <textarea
      {...props}
      className={["textarea", error ? "textarea-error" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      aria-invalid={error || undefined}
    />
  );

  return label ? (
    <label className="ui-field">
      {label && <span>{label}</span>}
      {textarea}
    </label>
  ) : (
    textarea
  );
}

export type SelectOption = { value: string; label: string };

export type SelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "className" | "onChange" | "value"
> & {
  className?: string;
  value?: string;
  placeholder?: ReactNode;
  options: SelectOption[];
  onChange?: (value: string) => void;
};

export function Select({
  className,
  value,
  placeholder,
  options,
  onChange,
  ...props
}: SelectProps) {
  const handleChange: ChangeEventHandler<HTMLSelectElement> = (event) => {
    onChange?.(event.target.value);
  };

  return (
    <select
      {...props}
      value={value ?? ""}
      onChange={handleChange}
      className={["select", className ?? ""].filter(Boolean).join(" ")}
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options.map((option) => (
        <option value={option.value} key={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export type TypographyProps = Omit<HTMLAttributes<HTMLElement>, "className"> & {
  as?: ElementType;
  variant?: string;
  level?: number;
  className?: string;
  children?: ReactNode;
};

export function Typography({
  as: Component = "span",
  variant = "body",
  level,
  className,
  children,
  ...props
}: TypographyProps) {
  return (
    <Component
      {...props}
      className={[
        "ui-typography",
        `ui-typography-${variant}`,
        level ? `ui-typography-level-${level}` : "",
        className ?? ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Component>
  );
}

export function TopBar({
  className,
  title,
  startAdornment,
  endAdornment
}: {
  className?: string;
  title?: ReactNode;
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
}) {
  return (
    <header className={["ui-topbar", className ?? ""].filter(Boolean).join(" ")}>
      <div className="ui-topbar-start">{startAdornment}</div>
      {title ? <div className="ui-topbar-title">{title}</div> : <span />}
      <div className="ui-topbar-end">{endAdornment}</div>
    </header>
  );
}

type TabsContextValue = {
  value?: string;
  onValueChange?: (value: string) => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

export function Tabs({
  value,
  onValueChange,
  children
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className="ui-tabs">{children}</div>
    </TabsContext.Provider>
  );
}

export function TabItem({
  value,
  icon,
  label,
  className,
  onPointerDown,
  children,
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  value: string;
  icon?: ReactNode;
  label?: ReactNode;
  onPointerDown?: PointerEventHandler<HTMLButtonElement>;
}) {
  const tabs = useContext(TabsContext);
  const active = tabs?.value === value;

  return (
    <button
      {...props}
      type="button"
      className={className}
      data-state={active ? "on" : "off"}
      aria-selected={active}
      onPointerDown={onPointerDown}
      onClick={() => tabs?.onValueChange?.(value)}
    >
      {icon}
      {label ?? children}
    </button>
  );
}

export function ListItem({
  label,
  description,
  startAdornment,
  endAdornment,
  className,
  onClick,
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  label: ReactNode;
  description?: ReactNode;
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
}) {
  return (
    <button
      {...props}
      type="button"
      className={["ui-list-item", className ?? ""].filter(Boolean).join(" ")}
      onClick={onClick}
    >
      {startAdornment ? <span className="ui-list-item-start">{startAdornment}</span> : null}
      <span className="ui-list-item-copy">
        <span className="ui-list-item-label">{label}</span>
        {description ? <span className="ui-list-item-description">{description}</span> : null}
      </span>
      {endAdornment ? <span className="ui-list-item-end">{endAdornment}</span> : null}
    </button>
  );
}

let toastIdCounter = 0;

export type ToastTone = "success" | "error" | "warning" | "info";
type ToastState = { id: number; title: string; tone: ToastTone } | null;
type ToastController = {
  success: (input: { title: string }) => void;
  error: (input: { title: string }) => void;
  warning: (input: { title: string }) => void;
  info: (input: { title: string }) => void;
};
type ToastApi = {
  toast: ToastController;
  current: ToastState;
  dismiss: () => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const api: ToastApi = {
    toast: {
      success: ({ title }) => setToast({ id: ++toastIdCounter, title, tone: "success" }),
      error: ({ title }) => setToast({ id: ++toastIdCounter, title, tone: "error" }),
      warning: ({ title }) => setToast({ id: ++toastIdCounter, title, tone: "warning" }),
      info: ({ title }) => setToast({ id: ++toastIdCounter, title, tone: "info" })
    },
    current: toast,
    dismiss: () => setToast(null)
  };

  return <ToastContext.Provider value={api}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}

function getToastSymbol(tone: ToastTone) {
  switch (tone) {
    case "success":
      return <SystemSymbol name="checkmark" size={13} />;
    case "warning":
      return <SystemSymbol name="clock" size={13} />;
    case "info":
      return <SystemSymbol name="info.circle" size={13} />;
    case "error":
    default:
      return <SystemSymbol name="exclamationmark.circle" size={13} />;
  }
}

export function Toaster({ duration = 3000 }: { duration?: number }) {
  const { current: toast, dismiss } = useToast();
  const [activeToast, setActiveToast] = useState<ToastState>(null);
  const toastRef = useRef<HTMLDivElement | null>(null);
  const isExitingRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleExit = useCallback(() => {
    if (isExitingRef.current) return;
    isExitingRef.current = true;
    clearTimer();

    const el = toastRef.current;
    if (!el) {
      setActiveToast(null);
      isExitingRef.current = false;
      dismiss();
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setActiveToast(null);
      isExitingRef.current = false;
      dismiss();
      return;
    }

    gsap.to(el, {
      xPercent: -50,
      y: -24,
      scale: 0.88,
      opacity: 0,
      duration: 0.24,
      ease: "power2.in",
      overwrite: "auto",
      onComplete: () => {
        setActiveToast(null);
        isExitingRef.current = false;
        dismiss();
      }
    });
  }, [clearTimer, dismiss]);

  useEffect(() => {
    if (!toast) {
      if (activeToast && !isExitingRef.current) {
        handleExit();
      }
      return;
    }

    isExitingRef.current = false;
    setActiveToast(toast);
    clearTimer();

    timerRef.current = window.setTimeout(() => {
      handleExit();
    }, duration);

    return () => {
      clearTimer();
    };
  }, [toast, duration, handleExit, clearTimer, activeToast]);

  useEffect(() => {
    if (!activeToast || isExitingRef.current) return;
    const el = toastRef.current;
    if (!el) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      gsap.set(el, { xPercent: -50, y: 0, scale: 1, opacity: 1 });
      return;
    }

    gsap.fromTo(
      el,
      {
        xPercent: -50,
        y: -28,
        scale: 0.86,
        opacity: 0
      },
      {
        xPercent: -50,
        y: 0,
        scale: 1,
        opacity: 1,
        duration: 0.38,
        ease: "back.out(1.5)",
        overwrite: "auto"
      }
    );
  }, [activeToast?.id]);

  if (!activeToast) return null;

  return (
    <div
      ref={toastRef}
      className={`ui-toast ui-toast-${activeToast.tone}`}
      role="status"
      aria-live="polite"
      onClick={handleExit}
    >
      <span className="ui-toast-badge" aria-hidden="true">
        {getToastSymbol(activeToast.tone)}
      </span>
      <span className="ui-toast-label">{activeToast.title}</span>
    </div>
  );
}
