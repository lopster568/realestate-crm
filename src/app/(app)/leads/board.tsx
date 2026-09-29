"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { Avatar } from "@/components/ui/avatar";
import { ScoreBadge } from "@/components/ui/score-badge";
import { cn } from "@/lib/cn";
import { changeLeadFieldAction } from "./actions";

type BoardLead = {
  id: string;
  name: string;
  status: string;
  priority: string;
  scoreBand: string | null;
  score: number | null;
  budgetLabel: string;
  assignedTo: string | null;
  source: string | null;
};

type Status = { value: string; label: string; color: string };

export function LeadBoard({
  leads,
  statuses,
}: {
  leads: BoardLead[];
  statuses: Status[];
}) {
  const [, startTransition] = useTransition();
  const [optimisticLeads, moveLead] = useOptimistic(
    leads,
    (state, { id, status }: { id: string; status: string }) =>
      state.map((l) => (l.id === id ? { ...l, status } : l))
  );

  function onDragEnd(result: DropResult) {
    const { draggableId, destination, source } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    startTransition(async () => {
      moveLead({ id: draggableId, status: destination.droppableId });
      await changeLeadFieldAction(draggableId, "status", destination.droppableId);
    });
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
        {statuses.map((status) => {
          const column = optimisticLeads.filter((l) => l.status === status.value);
          return (
            <Droppable droppableId={status.value} key={status.value}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    "w-64 shrink-0 rounded-card bg-canvas border border-line/60 flex flex-col max-h-[calc(100dvh-260px)]",
                    snapshot.isDraggingOver && "ring-2 ring-primary/30"
                  )}
                >
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <span className="size-2 rounded-full" style={{ backgroundColor: status.color }} />
                    <span className="text-[13px] font-semibold text-ink">{status.label}</span>
                    <span className="ml-auto text-[12px] text-ink-faint font-medium">{column.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
                    {column.map((lead, i) => (
                      <Draggable draggableId={lead.id} index={i} key={lead.id}>
                        {(p, snap) => (
                          <div
                            ref={p.innerRef}
                            {...p.draggableProps}
                            {...p.dragHandleProps}
                            className={cn(
                              "rounded-xl bg-surface border border-line/60 p-3 shadow-card",
                              snap.isDragging && "shadow-pop rotate-1"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <Link
                                href={`/leads/${lead.id}`}
                                className="text-[13px] font-medium text-ink hover:text-primary leading-snug"
                              >
                                {lead.name}
                              </Link>
                              <span
                                className={cn(
                                  "size-1.5 rounded-full mt-1.5 shrink-0",
                                  lead.priority === "HIGH" && "bg-accent-rose",
                                  lead.priority === "MEDIUM" && "bg-accent-amber",
                                  lead.priority === "LOW" && "bg-accent-sky"
                                )}
                                title={`${lead.priority.toLowerCase()} priority`}
                              />
                            </div>
                            <p className="text-[12px] text-ink-faint mt-1">
                              {lead.budgetLabel}
                              {lead.source ? ` · ${lead.source}` : ""}
                            </p>
                            {lead.scoreBand && (
                              <div className="mt-1.5">
                                <ScoreBadge band={lead.scoreBand} score={lead.score} />
                              </div>
                            )}
                            {lead.assignedTo && (
                              <div className="flex items-center gap-1.5 mt-2">
                                <Avatar name={lead.assignedTo} size="sm" />
                                <span className="text-[11px] text-ink-faint">{lead.assignedTo}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}
