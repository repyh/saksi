import type { ReactNode } from "react";

export interface NavActionItem {
  id: string;
  label: string;
  href: string;
  icon?: ReactNode;
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "link";
  isPrimary?: boolean;
  badge?: string;
  external?: boolean;
}

export interface NavBrandConfig {
  shortName: string;
  fullName: string;
  href?: string;
  logo?: ReactNode;
}

export interface NavbarProps {
  brand?: NavBrandConfig;
  actions?: NavActionItem[];
  className?: string;
  sticky?: boolean;
  extraContent?: ReactNode;
}
