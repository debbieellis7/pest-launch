"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { BrandMark } from "@/components/Sidebar";
import { cx } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/sales/calls";
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("That password didn't work. Try again.");
      return;
    }
    router.replace(next.startsWith("/") ? next : "/sales/calls");
  }

  return (
    <div className="relative w-full max-w-[400px]">
      <form
        onSubmit={onSubmit}
        className="rounded-3xl bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.04] sm:p-10"
      >
        <div className="flex flex-col items-center text-center">
          <BrandMark className="size-14 rounded-[16px] text-[22px] shadow-[0_8px_24px_rgba(0,113,227,0.35)]" />
          <h1 className="mt-5 text-[24px] font-bold tracking-tight">Call Intelligence</h1>
          <p className="mt-1 text-[15px] text-muted">Sign in to continue</p>
        </div>

        <label htmlFor="password" className="mt-8 block text-sm font-medium">
          Password
        </label>
        <div className="relative mt-1.5">
          <Lock
            className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-faint"
            aria-hidden
          />
          <input
            id="password"
            type={show ? "text" : "password"}
            autoFocus
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "password-error" : undefined}
            // Browsers/password managers inject styles into password fields before hydration.
            suppressHydrationWarning
            className={cx(
              "h-12 w-full rounded-xl border bg-white pl-11 pr-12 text-[15px] outline-none transition focus:ring-4",
              error
                ? "border-red focus:border-red focus:ring-red/15"
                : "border-line focus:border-accent focus:ring-accent/15",
            )}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-faint transition hover:bg-black/[0.04] hover:text-ink"
          >
            {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        </div>

        {error && (
          <p
            id="password-error"
            role="alert"
            className="mt-2.5 flex items-center gap-1.5 text-sm text-red"
          >
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-[15px] font-semibold text-white shadow-sm transition hover:brightness-110 active:brightness-95 disabled:opacity-70"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="size-4" aria-hidden />
            </>
          )}
        </button>
      </form>
      <p className="mt-6 text-center text-[13px] text-faint">Powered by PestLaunch</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas px-4 py-10">
      {/* Soft brand-blue glow behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(0,113,227,0.14),transparent)]"
      />
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
