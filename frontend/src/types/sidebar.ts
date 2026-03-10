import type { ReactNode } from "react";

export type SidebarDropdownItem = {
  id: string;
  label: string;
  badge?: ReactNode;
  isActive?: boolean;
  onClick: () => void;
};

export type SidebarItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
  isActive?: boolean;
  onClick: () => void;
  dropdownItems?: SidebarDropdownItem[];
};

export type SidebarSection = {
  id: string;
  title: string;
  items: SidebarItem[];
};
