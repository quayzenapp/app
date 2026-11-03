import Link from "next/link";
export default function Page() {
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="card max-w-lg">
        <h3>No access</h3>
        <p className="muted">This account is not set up in Quayzen, or it has been disabled. Please ask your administrator.</p>
        <div className="row"><Link className="btn" href="/login">Try signing in again</Link></div>
      </div>
    </div>
  );
}
