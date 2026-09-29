"use client";

import { AnimatePresence, motion } from "framer-motion";
import { dismissToast, useToast } from "@/lib/client/toast";

export function Toaster() {
  const toast = useToast();
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-6 z-[60] flex justify-center safe-bottom lg:bottom-8">
      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast.id}
            role="status"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto flex min-h-[52px] w-full max-w-[420px] items-center justify-between gap-3 rounded-[14px] bg-bar py-1.5 pr-1.5 pl-4 text-[14px] text-bar-ink shadow-float"
          >
            <span className="min-w-0 flex-1 truncate">{toast.message}</span>
            {toast.action ? (
              <button
                type="button"
                onClick={() => {
                  toast.action!.onClick();
                  dismissToast(toast.id);
                }}
                className="h-10 shrink-0 rounded-[10px] px-3.5 text-[14px] font-semibold text-toast-accent hover:bg-white/10"
              >
                {toast.action.label}
              </button>
            ) : (
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => dismissToast(toast.id)}
                className="h-10 shrink-0 rounded-[10px] px-3 text-bar-muted hover:bg-white/10"
              >
                ✕
              </button>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
