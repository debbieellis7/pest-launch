"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/Sidebar";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/sales/calls";
  const [password, setPassword] = useState("");
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
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04]"
    >
      <div className="flex flex-col items-center text-center">
        <BrandMark className="size-12 rounded-[14px]" />
        <h1 className="mt-4 text-[22px] font-bold tracking-tight">Call Intelligence</h1>
        <p className="mt-1 text-[15px] text-muted">Powered by PestLaunch</p>
      </div>
      <label className="mt-8 block">
        <span className="text-sm font-medium">Password</span>
        <input
          type="password"
          autoFocus
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          // Browsers/password managers inject styles into password fields before hydration.
          suppressHydrationWarning
          className="mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
        />
      </label>
      {error && <p className="mt-3 text-sm text-red">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="mt-5 w-full rounded-xl bg-accent px-3 py-2.5 text-[15px] font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
