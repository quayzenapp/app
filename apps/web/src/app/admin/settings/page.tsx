import { withTenant } from "@/lib/db";
import { DATE_FORMATS, FORM_DATE_FIELDS, dateFieldKey } from "@/lib/lic/date-formats";
import { loadDateFormats } from "@/lib/lic/date-format-store";
import { ActionForm } from "@/components/admin-ui";
import { secondPersonRequired } from "@/lib/controls";
import { requireAdmin } from "@/lib/tenant";
import { setOfficialDateFormats, setSecondPerson } from "../actions";

export default async function Controls() {
  const ctx = await requireAdmin();
  const formats = await withTenant(ctx.org.id, tx => loadDateFormats(tx, ctx.org.id));
  const on = await secondPersonRequired(ctx.org.id);
  return (
    <>
      <div className="head"><div className="t"><h1>Controls for {ctx.org.name}</h1></div></div>
      <div className="card"><h3>Second-person check <span className={`badge ${on ? "ok" : "warn"}`}>{on ? "On" : "Off"}</span></h3>
        <p className="muted">When on, the person who prepares an annual return, business plan or budget can&apos;t also approve it. Turn it off only if one person runs the organization&apos;s compliance alone. Each change is recorded in the audit log.</p>
        <ActionForm action={setSecondPerson} submit={on ? "Turn off" : "Turn on"} confirm={on ? "Turn off the second-person check? One person will then be able to prepare and approve the same return." : undefined}>
          <input type="hidden" name="value" value={on ? "off" : "on"} />
        </ActionForm>
      </div>
      <div className="card"><h3>Official form dates</h3>
        <p className="muted">These settings affect dates in single boxes on Schedule I, Schedule III, offshore Form III and UBO declarations. Separate day, month and year boxes, stored dates and on-screen dates stay unchanged. Approved copies keep the formats stored at approval. Annual-return dates are outside this setting.</p>
        <ActionForm action={setOfficialDateFormats} submit="Save date formats">
          <div key={JSON.stringify(formats)}>
          <label className="fld">Organization default<select name="defaultFormat" defaultValue={formats.defaultFormat}>{DATE_FORMATS.map(format => <option key={format}>{format}</option>)}</select></label>
          {[...new Set(FORM_DATE_FIELDS.map(e => e.form))].map(form => <fieldset className="card" key={form}><legend>{FORM_DATE_FIELDS.find(e => e.form === form)!.formLabel}</legend>
            <table className="qz-table"><thead><tr><th>Form field and label</th><th>Date format</th></tr></thead><tbody>
              {FORM_DATE_FIELDS.filter(e => e.form === form).map(e => <tr key={e.field}><td><label htmlFor={`format-${e.form}-${e.field}`}>{e.label}</label><div className="muted small">{e.field === e.pdf ? e.field : `${e.field} · ${e.pdf}`}</div>{e.explicit && <p className="help">The form asks for DD/MM/YY. This field has no inherited default; approval and export are blocked until you choose a format.</p>}</td><td><select id={`format-${e.form}-${e.field}`} name={`dateFormat:${e.form}:${e.field}`} defaultValue={formats.fields[dateFieldKey(e.form, e.field)] ?? ""}><option value="">{e.explicit ? "Not set — blocks this field" : "Use organization default"}</option>{DATE_FORMATS.map(format => <option key={format}>{format}</option>)}</select></td></tr>)}
            </tbody></table>
          </fieldset>)}
          </div>
        </ActionForm>
      </div>
    </>
  );
}
