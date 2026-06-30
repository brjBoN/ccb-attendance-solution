import Link from "next/link";
import { QrCode, ShieldCheck, UsersRound } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16">
        <div className="mb-8 inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
          <ShieldCheck className="h-4 w-4 text-brand-600" />
          Production-ready CCB QR attendance
        </div>

        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
          QR attendance for CCB small groups.
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          Generate secure QR check-in sessions, let attendees find themselves
          safely, and sync attendance back to CCB through server-side API calls.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            Open Admin
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
          >
            Sign in
          </Link>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          <FeatureCard
            icon={<QrCode className="h-5 w-5" />}
            title="Opaque QR tokens"
            body="Public URLs will use secure tokens rather than exposing CCB IDs."
          />
          <FeatureCard
            icon={<UsersRound className="h-5 w-5" />}
            title="CCB as source of truth"
            body="People, groups, events, and attendance stay grounded in CCB."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Deletion protected"
            body="Supported CCB create and update actions run immediately; destructive services are blocked."
          />
        </div>
      </section>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  body
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        {icon}
      </div>
      <h2 className="font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}
