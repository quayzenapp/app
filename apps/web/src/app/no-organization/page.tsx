import Link from "next/link";
export default function Page() {
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="card max-w-lg">
        <h3>No organization yet</h3>
        <p className="muted">Your account is active but has not been added to an organization. Please ask your administrator.</p>
        <div className="row"><Link className="btn" href="/login">Back</Link></div>
      </div>
    </div>
  );
}
