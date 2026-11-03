import { ActionForm } from "@/components/admin-ui";
import { RESTRICTED_CATEGORIES } from "@/lib/documents";
import type { State } from "@/app/(app)/documents/actions";

type Values = { title?: string; category?: string; access?: string; expiryDate?: string | null; notes?: string | null };
export function DocumentForm({ action, categories, values = {}, allowRestricted }: { action: (s: State, f: FormData) => Promise<State>; categories: string[]; values?: Values; allowRestricted: boolean }) {
  const options = allowRestricted ? categories : categories.filter((c) => !RESTRICTED_CATEGORIES.includes(c));
  return (
    <div className="card">
      <ActionForm action={action} submit="Save">
        <div className="grid2">
          <div className="fld"><label htmlFor="d_t">Document title <span className="req">*</span></label><input id="d_t" name="title" defaultValue={values.title} /></div>
          <div className="fld"><label htmlFor="d_c">Category <span className="req">*</span></label><select id="d_c" name="category" defaultValue={values.category ?? ""}><option value="">—</option>{options.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="fld"><label htmlFor="d_a">Access</label><select id="d_a" name="access" defaultValue={values.access ?? "Normal"}><option>Normal</option>{allowRestricted && <option>Restricted</option>}</select><span className="help">Restricted documents and their files are available only to roles that can see identity or ownership details. UBO, passport and visa documents are always restricted.</span></div>
          <div className="fld"><label htmlFor="d_e">Expiry date (if any)</label><input id="d_e" type="date" name="expiry_date" defaultValue={values.expiryDate ?? ""} /></div>
          <div className="fld wide"><label htmlFor="d_n">Notes</label><textarea id="d_n" name="notes" rows={3} defaultValue={values.notes ?? ""} /></div>
        </div>
      </ActionForm>
    </div>
  );
}
