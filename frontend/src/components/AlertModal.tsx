import type { ReactNode } from "react";

type AlertModalVariant = "info" | "success" | "warning" | "danger";

export type AlertModalProps = {
  title?: string;
  message: ReactNode;
  variant?: AlertModalVariant;
  actions?: ReactNode;
  onClose: () => void;
};

const VARIANT_TITLES: Record<AlertModalVariant, string> = {
  info: "Notice",
  success: "Success",
  warning: "Warning",
  danger: "Error",
};

export function AlertModal({
  title,
  message,
  variant = "info",
  actions,
  onClose,
}: AlertModalProps) {
  return (
    <div className="alert-modal-overlay">
      <div className={`alert-modal alert-modal-${variant}`}>
        <div className="alert-modal-header">
          <div>
            <strong>{title || VARIANT_TITLES[variant]}</strong>
          </div>
          <button
            type="button"
            className="alert-modal-close"
            aria-label="Close alert"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="alert-modal-body">{message}</div>
        <div className="alert-modal-actions">
          {actions}
          <button type="button" className="alert-modal-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default AlertModal;
