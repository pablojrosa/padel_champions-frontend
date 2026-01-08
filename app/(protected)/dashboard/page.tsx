import Link from "next/link";
import Card from "@/components/ui/Card";

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-zinc-300">Gestioná jugadores y torneos.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Link href="/players">
          <Card>
            <div className="p-5">
              <div className="font-medium">Players</div>
              <div className="text-sm text-zinc-600">Alta, edición y bajas</div>
            </div>
          </Card>
        </Link>

        <Link href="/tournaments">
          <Card>
            <div className="p-5">
              <div className="font-medium">Tournaments</div>
              <div className="text-sm text-zinc-600">Crear y administrar</div>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
