"use client";
import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import type { ActionState } from "@/app/admin/actions";

/**
 * React resets a form after its action finishes, even when validation failed, which wipes what the person typed.
 * This submits by hand, so input survives an error, and clears only on success. `action` stays for submits before hydration.
 */
export function useFormKeepingInput(run: (f: FormData) => void, result: { ok?: string } | null, ask?: string) {
  const ref = useRef<HTMLFormElement>(null);
  // Depend on the action result, not its message: two successful saves can both say "Saved.".
  useEffect(() => { if (result?.ok) ref.current?.reset(); }, [result]);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (ask && !window.confirm(ask)) return;
    const data = new FormData(e.currentTarget);
    startTransition(() => run(data));
  };
  return { ref, onSubmit };
}

/** A form whose server action reports success or an error inline. */
export function ActionForm({ action, children, className, submit, confirm: ask }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; children?: React.ReactNode; className?: string; submit: string; confirm?: string }) {
  const [state, run, pending] = useActionState(action, {});
  const { ref, onSubmit } = useFormKeepingInput(run, state, ask);
  return (
    <form ref={ref} action={run} className={className} onSubmit={onSubmit}>
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
