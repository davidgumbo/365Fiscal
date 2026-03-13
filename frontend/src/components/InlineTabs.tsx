import type { ReactNode } from "react";

type InlineTabItem<T extends string | number> = {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
};

type InlineTabsProps<T extends string | number> = {
  value: T;
  onChange: (value: T) => void;
  items: InlineTabItem<T>[];
  className?: string;
};

export function InlineTabs<T extends string | number>({
  value,
  onChange,
  items,
  className,
}: InlineTabsProps<T>) {
  const wrapperClass = ["settings-inline-tabs", className].filter(Boolean).join(" ");

  return (
    <div className={wrapperClass}>
      {items.map((item) => {
        const isActive = item.value === value;
        return (
          <button
            key={String(item.value)}
            type="button"
            className={`settings-inline-tab${isActive ? " active" : ""}`}
            aria-pressed={isActive}
            onClick={() => !item.disabled && onChange(item.value)}
            disabled={item.disabled}
          >
            {item.icon && <span className="settings-inline-tab-icon">{item.icon}</span>}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default InlineTabs;
