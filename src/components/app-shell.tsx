import { useEffect, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Apple,
  Dumbbell,
  Home,
  LineChart,
  ListChecks,
  LogOut,
  Settings,
  Shield,
  Sparkles,
  CalendarDays,
  Bell,
  Wand2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { setCheckin } from "@/lib/data";
import { useReminderScheduler } from "@/lib/reminders";
import { OFFLINE_CHECKIN_KEY, todayISO } from "@/lib/viva";

const NAV = [
  { to: "/inicio", label: "Início", icon: Home },
  { to: "/rotina", label: "Minha rotina", icon: CalendarDays },
  { to: "/alimentacao", label: "Alimentação", icon: Apple },
  { to: "/movimento", label: "Movimento", icon: Dumbbell },
  { to: "/habitos", label: "Hábitos", icon: ListChecks },
  { to: "/progresso", label: "Progresso", icon: LineChart },
  { to: "/viva-ai", label: "VIVA AI", icon: Sparkles },
  { to: "/ajustes", label: "Ajustes com IA", icon: Wand2 },
  { to: "/lembretes", label: "Lembretes", icon: Bell },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

const MOBILE_NAV = NAV.filter((item) =>
  ["/inicio", "/rotina", "/progresso", "/viva-ai", "/configuracoes"].includes(item.to),
);

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useReminderScheduler(user?.id);

  // Sincroniza check-ins salvos offline, sem criar duplicados (upsert por dia/item).
  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    const raw = window.localStorage.getItem(OFFLINE_CHECKIN_KEY);
    if (!raw) return;
    const pending = JSON.parse(raw) as Record<string, boolean>;
    const entries = Object.entries(pending);
    if (entries.length === 0) return;

    (async () => {
      try {
        for (const [key, done] of entries) {
          const [day, item] = key.split(":");
          if (!day || !item) continue;
          await setCheckin(user.id, item, done, day);
        }
        window.localStorage.removeItem(OFFLINE_CHECKIN_KEY);
        await queryClient.invalidateQueries({ queryKey: ["checkins", user.id, todayISO()] });
      } catch (error) {
        console.error("Falha ao sincronizar check-ins offline", error);
      }
    })();
  }, [user, queryClient]);


  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", {
        _user_id: user!.id,
        _role: "admin",
      });
      return Boolean(data);
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-sidebar px-4 py-6 lg:flex">
        <Link to="/inicio" className="px-3 font-display text-lg tracking-[0.25em]">
          VIVA
        </Link>
        <nav className="mt-9 flex-1 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeProps={{ className: "bg-sidebar-accent text-foreground" }}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
          {isAdmin ? (
            <Link
              to="/admin"
              activeProps={{ className: "bg-sidebar-accent text-foreground" }}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <Shield className="size-4" />
              Admin
            </Link>
          ) : null}
        </nav>
        <button
          onClick={async () => {
            await signOut();
            navigate({ to: "/" });
          }}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
        >
          <LogOut className="size-4" />
          Sair da conta
        </button>
      </aside>

      <main className="pb-24 lg:pl-64 lg:pb-0">
        <div className="mx-auto max-w-4xl px-5 py-8 sm:py-12">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-between px-2 py-2">
          {MOBILE_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeProps={{ className: "text-primary" }}
              className="flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] text-muted-foreground transition-colors"
            >
              <item.icon className="size-5" />
              {item.label === "Minha rotina" ? "Rotina" : item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
