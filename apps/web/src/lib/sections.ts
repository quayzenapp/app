export const ASSISTANT_NAME = "Quayza";
export const ASK_LABEL = `Ask ${ASSISTANT_NAME}`;

/** key, label, permission module, register forms. No forms and no custom page = not built yet, and the page says so. */
export type Section = { key: string; label: string; module: string | null; forms?: string[]; href?: string; icon?: string };
export const SECTIONS: Section[] = [
  { key: "dashboard", label: "Dashboard", module: "dashboard", href: "/dashboard" },
  { key: "company", label: "Company Profile", module: "company", forms: ["people", "ubo"], href: "/company" },
  { key: "apply", label: "Licence Application", module: "licensing" },
  { key: "changes", label: "Licence Changes", module: "licensing" },
  { key: "develop", label: "Development Approvals", module: "development" },
  { key: "checklists", label: "Checklists", module: "checklists" },
  { key: "bplan", label: "Business Plan Reference", module: "bplan" },
  { key: "requests", label: "Commission Requests", module: "requests", forms: ["requests", "templates"] },
  { key: "workforce", label: "Workforce", module: "workforce", forms: ["employees", "positions", "policies"] },
  { key: "investment", label: "Investment and Funding", module: "investment", forms: ["investments"] },
  { key: "budget", label: "Budget", module: "budget" },
  { key: "offices", label: "Office Space", module: "offices", forms: ["offices", "office_plans", "rent_options"] },
  { key: "returns", label: "Annual Returns", module: "returns", forms: ["fin_entries", "housing"], href: "/returns" },
  { key: "obligations", label: "Licences and Obligations", module: "obligations", forms: ["licences", "obligations"] },
  { key: "visas", label: "Visas and Permits", module: "visas", forms: ["visas"] },
  { key: "documents", label: "Documents", module: "documents", href: "/documents" },
  { key: "reports", label: "Reports", module: "reports" },
  { key: "library", label: ASSISTANT_NAME, module: null, href: "/ask", icon: "quayza" },
  { key: "howto", label: "How It Works", module: null },
  { key: "setup", label: "Setup", module: "settings", forms: ["fx_rates"] },
];
export const NAV_GROUPS: [string, string, string[]][] = [
  ["Overview", "dashboard", ["dashboard", "company", "checklists", "documents", "reports"]],
  ["Application", "apply", ["apply"]],
  ["Development", "develop", ["develop"]],
  ["Operations", "operations", ["workforce", "visas", "offices", "investment", "budget", "bplan"]],
  ["Compliance", "comply", ["obligations", "requests", "returns"]],
  ["Amendments", "changes", ["changes"]],
  ["Quayza", "quayza", ["library"]],
  ["Help", "howto", ["howto", "setup"]],
];
export const sectionHref = (s: Section) => s.href ?? `/s/${s.key}`;
export const sectionIcon = (s: Section) => s.icon ?? s.key;
