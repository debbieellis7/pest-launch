import { Card } from "@/components/ui";

/** Shown while any Sales page loads its calls, so a tab click responds immediately. */
export default function SalesLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <header className="mb-6">
        <h1 className="text-[34px] font-bold tracking-tight">Sales</h1>
        <div className="mt-4 h-[42px] w-full max-w-[340px] animate-pulse rounded-xl bg-black/[0.06]" />
        <div className="mt-3 h-3 w-40 animate-pulse rounded bg-black/[0.05]" />
      </header>
      <div className="space-y-6">
        {[0, 1, 2].map((n) => (
          <Card key={n} className="p-6">
            <div className="h-5 w-36 animate-pulse rounded bg-black/[0.07]" />
            <div className="mt-5 grid grid-cols-2 gap-6 sm:grid-cols-4">
              {[0, 1, 2, 3].map((m) => (
                <div key={m}>
                  <div className="h-3 w-20 animate-pulse rounded bg-black/[0.05]" />
                  <div className="mt-2 h-7 w-16 animate-pulse rounded bg-black/[0.07]" />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
