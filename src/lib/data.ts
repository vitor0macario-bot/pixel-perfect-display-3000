import { supabase } from "@/integrations/supabase/client";
import { generatePlan, todayISO, type QuizAnswers } from "./viva";

export type Task = {
  id: string;
  period: string;
  category: string;
  title: string;
  description: string;
  time_of_day: string | null;
  duration_min: number;
  sort_order: number;
  days: number[];
};

export function isTaskToday(task: Task, date = new Date()) {
  return !task.days || task.days.includes(date.getDay());
}

export async function ensureProfile(userId: string, fallbackName: string) {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (data) {
    await supabase
      .from("profiles")
      .update({ last_active_at: new Date().toISOString() })
      .eq("user_id", userId);
    return data;
  }

  const { data: created } = await supabase
    .from("profiles")
    .insert({ user_id: userId, name: fallbackName })
    .select()
    .single();

  await supabase
    .from("subscriptions")
    .upsert({ user_id: userId, plan: "free", status: "active" }, { onConflict: "user_id" });

  return created;
}

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchTasks(userId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, period, category, title, description, time_of_day, duration_min, sort_order, days")
    .eq("user_id", userId)
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function fetchCompletions(userId: string, day = todayISO()) {
  const { data, error } = await supabase
    .from("task_completions")
    .select("task_id")
    .eq("user_id", userId)
    .eq("day", day);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.task_id));
}

export async function toggleTask(userId: string, taskId: string, done: boolean, day = todayISO()) {
  if (done) {
    // Upsert avoids duplicated completions when syncing.
    const { error } = await supabase
      .from("task_completions")
      .upsert({ user_id: userId, task_id: taskId, day }, { onConflict: "user_id,task_id,day" });
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("task_completions")
    .delete()
    .eq("user_id", userId)
    .eq("task_id", taskId)
    .eq("day", day);
  if (error) throw error;
}

export async function fetchCheckins(userId: string, day = todayISO()) {
  const { data, error } = await supabase
    .from("checkins")
    .select("item, done")
    .eq("user_id", userId)
    .eq("day", day);
  if (error) throw error;
  return data ?? [];
}

export async function setCheckin(userId: string, item: string, done: boolean, day = todayISO()) {
  const { error } = await supabase
    .from("checkins")
    .upsert({ user_id: userId, item, done, day }, { onConflict: "user_id,day,item" });
  if (error) throw error;
}

export async function fetchHistory(userId: string, days = 30) {
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  const fromISO = from.toISOString().slice(0, 10);

  const [completions, checkins] = await Promise.all([
    supabase
      .from("task_completions")
      .select("day")
      .eq("user_id", userId)
      .gte("day", fromISO),
    supabase
      .from("checkins")
      .select("day, done")
      .eq("user_id", userId)
      .gte("day", fromISO),
  ]);

  const map = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    map.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of completions.data ?? []) {
    map.set(row.day, (map.get(row.day) ?? 0) + 1);
  }
  for (const row of checkins.data ?? []) {
    if (row.done) map.set(row.day, (map.get(row.day) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([day, count]) => ({ day, count }));
}

export function computeStreak(history: { day: string; count: number }[]) {
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if ((history[i]?.count ?? 0) > 0) streak++;
    else break;
  }
  return streak;
}

/** Cria o plano inicial a partir das respostas do quiz, sem duplicar tarefas. */
export async function applyQuizPlan(userId: string, answers: QuizAnswers) {
  await supabase.from("quiz_responses").insert({ user_id: userId, answers });

  const existing = await fetchTasks(userId);
  if (existing.length > 0) {
    await supabase.from("tasks").update({ active: false }).eq("user_id", userId);
  }

  const tasks = generatePlan(answers).map((task) => ({ ...task, user_id: userId }));
  const { error } = await supabase.from("tasks").insert(tasks);
  if (error) throw error;

  await supabase
    .from("profiles")
    .update({ quiz_completed: true, plan_created: true })
    .eq("user_id", userId);

  const habitCount = Array.isArray(answers["habitos"]) ? answers["habitos"].length : 1;
  const { data: goals } = await supabase.from("goals").select("id").eq("user_id", userId).limit(1);
  if (!goals?.length) {
    await supabase.from("goals").insert([
      { user_id: userId, title: "Dias com check-in completo", target: 5 },
      { user_id: userId, title: "Hábitos mantidos na semana", target: Math.max(3, habitCount) },
    ]);
  }
}

export async function fetchSubscription(userId: string) {
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}
