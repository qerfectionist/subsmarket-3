import type { ReactNode } from "react";

export function FieldNote({ error, helper }: { error?: string; helper?: ReactNode }) {
  if (error) {
    return (
      <small className="field-error" role="alert" aria-live="polite">
        {error}
      </small>
    );
  }
  return helper ? <small className="field-helper">{helper}</small> : null;
}
