import { ActionForm } from "@/components/admin-ui";
import { secondPersonRequired } from "@/lib/controls";
import { requireAdmin } from "@/lib/tenant";
import { setSecondPerson } from "../actions";

export default async function Controls() {
  const ctx = await requireAdmin();
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
    </>
  );
}
