import { MobileBar, Sidebar } from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <MobileBar />
        {/* break-words: speech-to-text can glue a spelled-out name or email into one very
            long "word"; let it wrap instead of widening the page. */}
        <main className="break-words px-4 py-6 sm:px-8 lg:px-12 lg:py-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
