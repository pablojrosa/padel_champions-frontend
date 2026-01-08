import type { TournamentStatus } from "@/lib/types";

export default function StatusBadge({ status }: { status: TournamentStatus }) {
  const label =
    status === "upcoming" ? "Upcoming" : status === "ongoing" ? "Ongoing" : "Finished";

  const cls =
    status === "upcoming"
      ? "bg-zinc-100 text-zinc-700 border-zinc-200"
      : status === "ongoing"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : "bg-zinc-200 text-zinc-800 border-zinc-300";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
