import type { TournamentStatus } from "@/lib/types";

export default function StatusBadge({ status }: { status: TournamentStatus }) {
  const label =
    status === "upcoming"
      ? "Por jugar"
      : status === "ongoing"
      ? "En curso"
      : status === "groups_finished"
      ? "Zonas finalizadas"
      : "Finalizado";

  const cls =
    status === "upcoming"
      ? "bg-zinc-100 text-zinc-700 border-zinc-200"
      : status === "ongoing"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "groups_finished"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-zinc-200 text-zinc-800 border-zinc-300";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
