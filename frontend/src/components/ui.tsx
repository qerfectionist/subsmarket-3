import {
  createContext,
  useContext,
  useEffect,
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

type ToastState = { title: string; tone: "success" | "error" } | null;
type ToastController = {
  success: (input: { title: string }) => void;
  error: (input: { title: string }) => void;
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
      success: ({ title }) => setToast({ title, tone: "success" }),
      error: ({ title }) => setToast({ title, tone: "error" })
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

export function Toaster({ duration = 3000 }: { duration?: number }) {
  const { current: toast, dismiss } = useToast();

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(dismiss, duration);
    return () => window.clearTimeout(timeout);
  }, [dismiss, duration, toast]);

  if (!toast) return null;
  return (
    <div className={`ui-toast ui-toast-${toast.tone}`} role="status" aria-live="polite">
      {toast.title}
    </div>
  );
}
