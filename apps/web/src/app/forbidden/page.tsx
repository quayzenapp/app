import Link from "next/link";
export default function Page() {
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="card max-w-lg">
        <h3>You don't have access to this</h3>
        <p className="muted">Your role doesn't include this section. Ask your organization's administrator if you need it.</p>
        <div className="row"><Link className="btn" href="/dashboard">Back to the dashboard</Link></div>
      </div>
    </div>
  );
}
