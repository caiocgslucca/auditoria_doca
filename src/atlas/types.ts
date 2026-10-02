import type { CSSProperties, ReactNode } from "react";
export type Entity = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  category?: string;
  status?: string;
  price?: number;
  value?: number;
  quantity?: number;
  image?: string;
  person?: string;
  email?: string;
  date?: string;
  time?: string;
  duration?: string;
  location?: string;
  role?: string;
  progress?: number;
  tag?: string;
  size?: string;
  type?: string;
  bedrooms?: number;
  area?: number;
  rating?: number;
};
export type Theme = {
  mode: "light" | "dark";
  accent: string;
  accentText: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  line: string;
  serif?: boolean;
  radius?: number;
};
export type TemplateConfig = {
  schemaVersion: 1;
  templateId: string;
  locale: string;
  branding: { name: string; shortName: string; tagline: string };
  theme: Theme;
  content: Record<string, string>;
  collections: Record<string, Entity[]>;
};
export type TemplateProps = { config: TemplateConfig };
export type NavItem = {
  id: string;
  label: string;
  icon: ReactNode;
  count?: number;
};
export type CSSVars = CSSProperties & Record<`--${string}`, string | number>;
export const money = (value: number, locale = "pt-BR") =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value);
export const compactMoney = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
export const list = (c: TemplateConfig, key = "items"): Entity[] =>
  c.collections[key] || [];
export const asset = (name: string) =>
  name.startsWith("data:") ||
  name.startsWith("blob:") ||
  name.startsWith("https://")
    ? name
    : `https://lovekingcode.lovable.app/atlas/${name}`;
export const makeId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
