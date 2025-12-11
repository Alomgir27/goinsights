"use client";

import React from "react";
import { create } from "zustand";
import { X, CheckCircle, AlertCircle, Info, Loader2 } from "lucide-react";

type ToastType = "success" | "error" | "info";
interface Toast { id: string; message: string; type: ToastType; }
interface ToastStore { toasts: Toast[]; add: (message: string, type: ToastType) => void; remove: (id: string) => void; }

export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  add: (message: string, type: ToastType) => {
    const id = Math.random().toString(36).slice(2);
    set((state: ToastStore) => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => set((state: ToastStore) => ({ toasts: state.toasts.filter((t) => t.id !== id) })), 4000);
  },
  remove: (id: string) => set((state: ToastStore) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
}));

const icons: Record<ToastType, React.ComponentType<{ className?: string }>> = { success: CheckCircle, error: AlertCircle, info: Info };
const styles: Record<ToastType, string> = {
  success: "bg-emerald-50 border-emerald-200 text-emerald-700",
  error: "bg-red-50 border-red-200 text-red-700",
  info: "bg-blue-50 border-blue-200 text-blue-700"
};

export function ToastContainer(): React.ReactElement {
  const { toasts, remove } = useToast();
  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-3">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        return (
          <div key={toast.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg ${styles[toast.type]} animate-fade-up`}>
            <Icon className="w-5 h-5" />
            <span className="text-small font-medium">{toast.message}</span>
            <button onClick={() => remove(toast.id)} className="ml-2 opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
          </div>
        );
      })}
    </div>
  );
}

export function ProcessingIndicator({ message }: { message: string }): React.ReactElement | null {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-up">
      <div className="flex items-center gap-3 px-5 py-3 rounded-full bg-slate-900 text-white shadow-2xl">
        <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}
