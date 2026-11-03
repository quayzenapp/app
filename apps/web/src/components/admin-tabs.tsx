"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminTabs({ links }: { links: string[][] }) {
  const path = usePathname();
  return (
    <div className="tabs" role="tablist">
      {links.map(([href, label]) => {
        const on = href === "/admin" ? path === href : path.startsWith(href);
        return <Link key={href} href={href} role="tab" aria-selected={on} className={`tab${on ? " on" : ""}`}>{label}</Link>;
      })}
      <Link href="/dashboard" className="tab">← Back to the app</Link>
    </div>
  );
}
