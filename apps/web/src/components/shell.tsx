"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Pic, useTheme } from "@/components/theme";
import { ASK_LABEL, NAV_GROUPS, SECTIONS, sectionHref, sectionIcon } from "@/lib/sections";
import { logoutAction, switchOrgAction } from "@/app/(app)/actions";

export type ShellProps = { orgId: string; orgs: { id: string; name: string }[]; roleName: string; isDemo: boolean; allowed: string[]; isAdmin: boolean; userName: string };

function Logo() {
  const { look, dark } = useTheme();
  return (
    <Link className="brand" href="/dashboard" aria-label="Quayzen home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="qz-logo" src={`/logo/quayzen-pencil-${dark ? "dark" : "light"}.svg`} alt="Quayzen" style={look === "pro" ? { display: "none" } : undefined} />
      <span className="qz-clean" style={look === "pro" ? undefined : { display: "none" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="qz-mark" src="/logo/quayzen-mark-professional.svg" alt="" /><span className="qz-word">quayzen</span>
      </span>
    </Link>
  );
}

export function Topbar(p: ShellProps) {
  const { look, setLook, dark, toggleDark } = useTheme();
  return (
    <div className="topbar">
      <Logo />
      <div className="cosel">
        <form action={switchOrgAction}>
          <select name="orgId" defaultValue={p.orgId} key={p.orgId} aria-label="Organization" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
            {p.orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </form>
        <span className="role">{p.roleName}{p.isDemo && <> <span className="badge warn">DEMO</span></>}</span>
      </div>
      <div className="crumb" />
      <div className="tgroup">
        <div className="look-seg" role="group" aria-label="Charts and icons style">
          <button type="button" className={look !== "pro" ? "on" : ""} aria-pressed={look !== "pro"} onClick={() => setLook("pencil")}>Pencil</button>
          <button type="button" className={look === "pro" ? "on" : ""} aria-pressed={look === "pro"} onClick={() => setLook("pro")}>Professional</button>
        </div>
        <Link className="btn sm" href="/ask"><Pic name="quayza" className="pi" /><span className="hide-sm">{ASK_LABEL}</span></Link>
        {p.isAdmin && <Link className="btn sm" href="/admin"><Pic name="setup" className="pi" /><span className="hide-sm">Admin</span></Link>}
        <button type="button" className="iconbtn" aria-label={dark ? "Switch to light" : "Switch to dark"} onClick={toggleDark}><Pic name={dark ? "moon" : "sun"} className="pi" /></button>
        <form action={logoutAction}><button className="btn sm" title={p.userName}>Sign out</button></form>
      </div>
    </div>
  );
}

export function Dock({ allowed }: { allowed: string[] }) {
  const path = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const label = (k: string) => SECTIONS.find((s) => s.key === k)!;
  const groups = NAV_GROUPS.map(([g, icon, ks]) => [g, icon, ks.filter((k) => allowed.includes(k))] as const).filter((g) => g[2].length);
  const isOn = (k: string) => path.startsWith(sectionHref(label(k)));
  const current = groups.find((g) => g[0] === open);
  return (
    <>
      {current && (
        <>
          <div className="dk-scrim" onClick={() => setOpen(null)} />
          <div className="dk-panel" role="dialog" aria-label={current[0]}>
            <div className="dk-ph"><b>{current[0]}</b><span className="muted small">{current[2].length} functions</span></div>
            <div className="dk-grid">
              {current[2].map((k) => (
                <Link key={k} href={sectionHref(label(k))} className={`dk-item${isOn(k) ? " on" : ""}`} onClick={() => setOpen(null)}>
                  <Pic name={sectionIcon(label(k))} /><span>{label(k).label}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
      <nav className="dock" aria-label="Sections">
        {groups.map(([g, icon, ks]) => {
          const on = ks.some(isOn), cls = `dk-btn${on ? " on" : ""}${open === g ? " open" : ""}`;
          return ks.length === 1 ? (
            <Link key={g} className={cls} href={sectionHref(label(ks[0]))} title={label(ks[0]).label} onClick={() => setOpen(null)}><Pic name={icon} /><span>{g}</span></Link>
          ) : (
            <button key={g} type="button" className={cls} aria-expanded={open === g} title={g} onClick={() => setOpen(open === g ? null : g)}>
              <Pic name={icon} /><span>{g}</span><i className="dk-n">{ks.length}</i>
            </button>
          );
        })}
      </nav>
    </>
  );
}
