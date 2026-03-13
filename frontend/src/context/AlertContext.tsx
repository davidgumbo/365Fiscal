import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { AlertModal, type AlertModalProps } from "../components/AlertModal";

type AlertConfig = Omit<AlertModalProps, "onClose">;

type ConfirmConfig = Omit<AlertModalProps, "actions" | "onClose"> & {
  confirmLabel?: string;
  cancelLabel?: string;
};

type AlertContextValue = {
  showAlert: (config: AlertConfig) => void;
  hideAlert: () => void;
  showConfirm: (config: ConfirmConfig) => Promise<boolean>;
};

const AlertContext = createContext<AlertContextValue | null>(null);

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig | null>(null);
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);

  const showAlert = useCallback((config: AlertConfig) => {
    setAlertConfig(config);
  }, []);

  const hideAlert = useCallback(() => {
    setAlertConfig(null);
  }, []);

  const resolveConfirmation = useCallback((result: boolean) => {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(result);
      confirmResolverRef.current = null;
    }
    setConfirmConfig(null);
  }, []);

  const showConfirm = useCallback((config: ConfirmConfig) => {
    return new Promise<boolean>((resolve) => {
      if (confirmResolverRef.current) {
        confirmResolverRef.current(false);
      }
      confirmResolverRef.current = resolve;
      setConfirmConfig(config);
    });
  }, []);

  const value = useMemo(
    () => ({ showAlert, hideAlert, showConfirm }),
    [showAlert, hideAlert, showConfirm],
  );

  return (
    <AlertContext.Provider value={value}>
      {children}
      {alertConfig && (
        <AlertModal {...alertConfig} onClose={hideAlert} />
      )}
      {confirmConfig && (
        <AlertModal
          {...confirmConfig}
          variant={confirmConfig.variant ?? "warning"}
          actions={
            <>
              <button
                type="button"
                className="alert-modal-btn"
                onClick={() => resolveConfirmation(false)}
              >
                {confirmConfig.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="button"
                className="alert-modal-btn alert-modal-btn--primary"
                onClick={() => resolveConfirmation(true)}
              >
                {confirmConfig.confirmLabel ?? "Confirm"}
              </button>
            </>
          }
          onClose={() => resolveConfirmation(false)}
        />
      )}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlert must be used within an AlertProvider");
  }
  return context;
}

export default AlertProvider;
