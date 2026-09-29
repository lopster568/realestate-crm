"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scoreLeadsAction } from "./actions";

export function ScoreButton() {
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-[12px] text-ink-faint">{msg}</span>}
      <Button
        variant="secondary"
        onClick={() =>
          startTransition(async () => {
            setMsg(null);
            const result = await scoreLeadsAction({
              status: sp.get("status") ?? undefined,
              assignedToId: sp.get("agent") ?? undefined,
            });
            if ("error" in result) setMsg(result.error);
            else if (result.scored === 0 && result.failed === 0) setMsg("No leads to score");
            else setMsg(`Scored ${result.scored} leads${result.failed ? ` · ${result.failed} failed, retry` : ""}`);
          })
        }
        disabled={pending}
      >
        <Sparkles size={15} />
        {pending ? "Scoring…" : "Score leads"}
      </Button>
    </div>
  );
}
