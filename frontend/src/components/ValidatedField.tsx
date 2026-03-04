import { ReactElement, cloneElement, isValidElement } from "react";

const joinClassName = (...classes: Array<string | undefined | false>): string =>
  classes.filter(Boolean).join(" ");

type ValidatedFieldProps = {
  label?: React.ReactNode;
  isInvalid?: boolean;
  className?: string;
  labelClassName?: string;
  helperText?: React.ReactNode;
  children: ReactElement;
};

export default function ValidatedField({
  label,
  isInvalid = false,
  className,
  labelClassName,
  helperText,
  children,
}: ValidatedFieldProps) {
  if (!isValidElement(children)) return null;

  const enhancedChild =
    isInvalid && typeof children.type === "string"
      ? cloneElement(children, {
          className: joinClassName(
            (children.props as { className?: string }).className,
            "input-field-error",
          ),
        })
      : children;

  return (
    <div className={joinClassName("validated-field", className)}>
      {label ? (
        <label
          className={joinClassName(
            "form-label",
            labelClassName,
            isInvalid ? "form-label-error" : "",
          )}
        >
          {label}
        </label>
      ) : null}
      {enhancedChild}
      {helperText && (
        <small className="text-muted" style={{ display: "block" }}>
          {helperText}
        </small>
      )}
    </div>
  );
}
