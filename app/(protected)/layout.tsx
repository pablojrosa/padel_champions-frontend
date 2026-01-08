import AppShell from "@/components/AppShell";
import ProtectedGuard from "@/components/ProtectedGuard";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedGuard>
      <AppShell>{children}</AppShell>
    </ProtectedGuard>
  );
}
