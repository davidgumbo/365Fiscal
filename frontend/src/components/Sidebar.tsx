import { Fragment, type CSSProperties, type KeyboardEvent } from "react";
import type { SidebarSection } from "../types/sidebar";
import { ChevronDown, ChevronUp } from "lucide-react";

const isActivationKey = (key: string) => key === "Enter" || key === " ";

const handleActivationKey = (
  event: KeyboardEvent<HTMLDivElement>,
  callback: () => void,
) => {
  if (!isActivationKey(event.key)) return;
  event.preventDefault();
  callback();
};

type SidebarProps = {
  sections: SidebarSection[];
  className?: string;
};

export function Sidebar({ sections, className }: SidebarProps) {
  const wrapperClass = ["o-sidebar", className].filter(Boolean).join(" ");
  const buildIconStyle = (
    color?: string,
    background?: string,
  ): CSSProperties => ({
    "--sidebar-icon-color": color,
    "--sidebar-icon-bg": background,
  } as CSSProperties);

  return (
    <div className={wrapperClass}>
      {sections.map((section) => (
        <div className="o-sidebar-section" key={section.id}>
          <div className="o-sidebar-title">{section.title}</div>
          {section.items.map((item) => {
            const hasDropdown = Boolean(item.dropdownItems?.length);
            const dropdownActive = item.dropdownItems?.some(
              (dropdownItem) => dropdownItem.isActive,
            );
            const dropdownOpen = hasDropdown && (item.isActive || dropdownActive);
            const iconStyle = buildIconStyle(
              item.iconColor,
              item.iconBackground,
            );

            return (
              <Fragment key={item.id}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-pressed={item.isActive ? "true" : "false"}
                  className={`o-sidebar-item ${item.isActive ? "active" : ""}`}
                  onClick={item.onClick}
                  onKeyDown={(event) => handleActivationKey(event, item.onClick)}
                >
                  <span className="o-sidebar-item-label">
                    {item.icon && (
                      <span
                        className="o-sidebar-item-icon"
                        style={iconStyle}
                      >
                        {item.icon}
                      </span>
                    )}
                    <span className="o-sidebar-item-text">{item.label}</span>
                  </span>
                  {hasDropdown && (
                    <span
                      aria-hidden="true"
                      className="o-sidebar-dropdown-indicator"
                    >
                      {dropdownOpen ? <ChevronUp /> : <ChevronDown />}
                    </span>
                  )}
                  {item.badge && <span className="o-sidebar-count">{item.badge}</span>}
                </div>

                {hasDropdown && (
                  <details className="o-sidebar-dropdown" open={dropdownOpen}>
                    <summary aria-hidden tabIndex={-1} />
                    <div className="o-sidebar-dropdown-content">
                      {item.dropdownItems!.map((dropdownItem) => (
                        <div
                          key={dropdownItem.id}
                          role="button"
                          tabIndex={0}
                          aria-pressed={dropdownItem.isActive ? "true" : "false"}
                          className={`o-sidebar-item ${
                            dropdownItem.isActive ? "active" : ""
                          }`}
                          onClick={dropdownItem.onClick}
                          onKeyDown={(event) =>
                            handleActivationKey(event, dropdownItem.onClick)
                          }
                        >
                          <span
                            style={{
                              letterSpacing: "0.5px",
                              fontSize: 12,
                              fontWeight: 500,
                            }}
                          >
                            {dropdownItem.label}
                          </span>
                          {dropdownItem.badge && (
                            <span className="o-sidebar-count">{dropdownItem.badge}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </Fragment>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default Sidebar;
