export const MODULES = ["dashboard", "company", "bplan", "requests", "workforce", "investment", "offices", "returns", "obligations", "visas", "documents", "reports", "settings", "audit", "budget", "licensing", "development", "checklists"] as const;
export const MODULE_LABELS: Record<string, string> = { dashboard: "Dashboard", company: "Company profile", bplan: "Business plan", requests: "Commission requests", workforce: "Workforce", investment: "Investment and funding", offices: "Office space", returns: "Annual returns", obligations: "Licences and obligations", visas: "Visas and permits", documents: "Documents", reports: "Reports", settings: "Setup and administration", audit: "Audit log", budget: "Budget", licensing: "Licence application and changes", development: "Development approvals", checklists: "Checklists" };
export const LEVELS = ["none", "read", "write", "approve"] as const;
export type Level = (typeof LEVELS)[number];
export const SENSITIVE_LABELS: Record<string, string> = { personal: "Names and personal details", id: "Passport and identity details", pay: "Individual pay", ubo: "Beneficial ownership details", bank: "Bank and payment references" };

const rank = (l?: string) => Math.max(0, LEVELS.indexOf((l ?? "none") as Level));
export const can = (perms: Record<string, string>, module: string, level: Level = "read") => rank(perms[module]) >= rank(level);
