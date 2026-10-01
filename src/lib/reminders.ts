import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "./viva";

export type Reminder = {
  id: string;
  title: string;
  remind_at: string;
  days: number[];
  enabled: boolean;
};

export const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export async function fetchReminders(userId: string) {
  const { data, error } = await supabase
    .from("reminders")
    .select("id, title, remind_at, days, enabled")
    .eq("user_id", userId)
    .order("remind_at");
  if (error) throw error;
  return (data ?? []) as Reminder[];
}

export function useReminders(userId: string | undefined) {
  return useQuery({
    queryKey: ["reminders", userId],
    enabled: !!userId,
    queryFn: () => fetchReminders(userId!),
  });
}

/** Dispara lembretes enquanto o app está aberto (toast + notificação do navegador). */
export function useReminderScheduler(userId: string | undefined) {
  const { data } = useReminders(userId);
  useEffect(() => {
    if (!data?.length) return;
    const tick = () => {
      const now = new Date();
      const hhmm = now.toTimeString().slice(0, 5);
      for (const r of data) {
        if (!r.enabled || !r.days.includes(now.getDay())) continue;
        if (r.remind_at.slice(0, 5) !== hhmm) continue;
        const key = `viva:reminder-fired:${r.id}:${todayISO()}`;
        if (localStorage.getItem(key)) continue;
        localStorage.setItem(key, "1");
        toast(`Lembrete: ${r.title}`);
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("VIVA", { body: r.title });
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 20000);
    return () => window.clearInterval(id);
  }, [data]);
}
