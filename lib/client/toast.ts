import { useSyncExternalStore } from "react";

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; onClick: () => void };
  tone?: "default" | "error";
}

let current: Toast | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showToast(t: Omit<Toast, "id">, duration = 5000) {
  if (timer) clearTimeout(timer);
  current = { ...t, id: ++seq };
  emit();
  const id = current.id;
  timer = setTimeout(() => dismissToast(id), duration);
}

export function dismissToast(id?: number) {
  if (id !== undefined && current?.id !== id) return;
  current = null;
  emit();
}

export function useToast() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );
}
