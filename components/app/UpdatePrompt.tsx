"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { useSpace } from "@/components/app/SpaceProvider";

/** Offers a reload once the server runs a newer release than this page. */
export function UpdatePrompt() {
  const { newBuild } = useSpace();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const later = () => setDismissed(newBuild);

  return (
    <Sheet
      open={!!newBuild && newBuild !== dismissed}
      onOpenChange={(open) => !open && later()}
      title="A new version is ready"
      description="Reload to get the latest changes. Nothing you've added is lost."
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={later}
            className="h-12 flex-1 rounded-[14px] border border-line-2 bg-surface text-[16px] font-medium text-ink"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-12 flex-1 rounded-[14px] bg-clay text-[16px] font-semibold text-on-clay"
          >
            Reload
          </button>
        </div>
      }
    >
      {null}
    </Sheet>
  );
}
