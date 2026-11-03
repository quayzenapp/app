"use client";
import { useActionState } from "react";
import type { ActionState } from "@/app/admin/actions";

/** A form whose server action reports success or an error inline. */
export function ActionForm({ action, children, className, submit, confirm: ask }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; children?: React.ReactNode; className?: string; submit: string; confirm?: string }) {
  const [state, run, pending] = useActionState(action, {});
  return (
    <form action={run} className={className} onSubmit={(e) => { if (ask && !window.confirm(ask)) e.preventDefault(); }}>
      {children}
      <button className="btn sm" disabled={pending}>{pending ? "Working…" : submit}</button>
      {state.error && <div className="banner bad" role="alert">{state.error}</div>}
      {state.ok && <div className="banner info" role="status">{state.ok}</div>}
    </form>
  );
}

/** A destructive button that asks first. */
export function ConfirmButton({ action, label, ask }: { action: () => Promise<void>; label: string; ask: string }) {
  return <form action={action} onSubmit={(e) => { if (!window.confirm(ask)) e.preventDefault(); }}><button className="btn sm">{label}</button></form>;
}
