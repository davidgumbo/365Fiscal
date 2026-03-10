import { Fragment, type ComponentType, type ReactNode } from "react";

export type SidebarMenuItem = {
  key: string;
  label: string;
  icon?: ComponentType<{ color?: string }>;
  color?: string;
  badge?: ReactNode;
  dropdown?: ReactNode;
};

type SidebarMenuProps = {
  title: string;
  items: SidebarMenuItem[];
  activeKey?: string | null;
  onSelect: (key: string) => void;
};

export function SidebarMenu({ title, items, activeKey, onSelect }: SidebarMenuProps) {
  return (
    <div className="o-sidebar">
      <div className="o-sidebar-section">
        <div className="o-sidebar-title">{title}</div>
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeKey === item.key;

          return (
            <Fragment key={item.key}>
              <div
                className={`o-sidebar-item ${isActive ? "active" : ""}`}
                onClick={() => onSelect(item.key)}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {Icon && <Icon color={item.color} />}
                  <span
                    style={{
                      letterSpacing: "0.5px",
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    {item.label}
                  </span>
                </span>
                {item.badge && (
                  <span className="o-sidebar-count">{item.badge}</span>
                )}
              </div>
              {item.dropdown && (
                <details className="o-sidebar-dropdown" open={isActive}>
                  <summary aria-hidden tabIndex={-1} />
                  <div className="o-sidebar-dropdown-content">{item.dropdown}</div>
                </details>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

export default SidebarMenu;
