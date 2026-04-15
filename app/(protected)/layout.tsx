import AppShell from "@/components/AppShell";
import ProtectedGuardNoSSR from "@/components/ProtectedGuardNoSSR";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedGuardNoSSR>
      <AppShell>{children}</AppShell>
    </ProtectedGuardNoSSR>
  );
}
