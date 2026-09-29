"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/client/util";

/** Bottom sheet on phones, centred dialog on larger screens. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/35 data-[state=open]:animate-[fade_150ms_ease-out]" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex max-h-[88dvh] flex-col bg-bg text-ink shadow-float outline-none",
            "inset-x-0 bottom-0 rounded-t-[22px] safe-bottom data-[state=open]:animate-[sheet-up_220ms_cubic-bezier(.2,.8,.2,1)]",
            "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[min(92vw,460px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[20px] sm:data-[state=open]:animate-[fade_150ms_ease-out]",
            wide && "sm:w-[min(92vw,560px)]",
          )}
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line-2 sm:hidden" aria-hidden />
          <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-2">
            <div className="min-w-0">
              <Dialog.Title className="font-display text-[22px] font-semibold tracking-[-0.3px]">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-[14px] text-ink-3">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-sunken"
              aria-label="Close"
            >
              <Icon.Close size={20} />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
          {footer ? <div className="border-t border-line-soft px-5 py-4">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
