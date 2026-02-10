import BrandLogo from "@/components/BrandLogo";

export default function ViewerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="ambient-blobs blob-1 absolute -left-24 top-16 h-64 w-64 rounded-full bg-emerald-500/20 blur-[120px]" />
        <div className="ambient-blobs blob-2 absolute right-0 top-0 h-96 w-96 rounded-full bg-amber-400/10 blur-[140px]" />
        <div className="ambient-blobs blob-3 absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-sky-500/10 blur-[140px]" />
      </div>
      <div className="relative z-10">
        <header className="mx-auto flex w-full max-w-screen-2xl items-center justify-between px-4 py-5">
          <BrandLogo theme="dark" />
        </header>
        {children}
      </div>
    </div>
  );
}
