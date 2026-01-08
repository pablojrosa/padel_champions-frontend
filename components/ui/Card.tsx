export default function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white text-zinc-900 shadow-xl ring-1 ring-zinc-200">
      {children}
    </div>
  );
}