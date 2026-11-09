export interface BudgetExplorerNode {
  label: string;
  count: number;
  locatedCount?: number;
  median?: number;
  minBudget?: number;
  maxBudget?: number;
  budget: number;
  mapHref?: string;
  children?: BudgetExplorerNode[];
  records?: { rup: string; name: string; budget: number; precision: string; href: string }[];
}
