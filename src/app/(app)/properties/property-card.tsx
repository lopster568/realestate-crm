"use client";

import { useState } from "react";
import { Bath, BedDouble, Home, MapPin, Pencil, Ruler, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { SerializedProperty } from "@/server/services/properties";
import { deletePropertyAction } from "./actions";
import { PropertyFormButton } from "./property-form";

const availabilityColor: Record<string, string> = {
  AVAILABLE: "#22C55E",
  UNDER_CONSTRUCTION: "#F59E0B",
  RESERVED: "#0EA5E9",
  SOLD: "#F43F5E",
};

const availabilityLabel: Record<string, string> = {
  AVAILABLE: "Available",
  UNDER_CONSTRUCTION: "Under construction",
  RESERVED: "Reserved",
  SOLD: "Sold",
};

export function PropertyCard({
  property: p,
  priceLabel,
  categories,
  canEdit,
  canDelete,
}: {
  property: SerializedProperty;
  priceLabel: string;
  categories: Array<{ value: string; label: string }>;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cover = p.images[0];

  return (
    <Card className="overflow-hidden flex flex-col">
      <div className="relative h-40 bg-canvas">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- local uploads, unknown dimensions
          <img src={cover} alt={p.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-faint">
            <Home size={28} strokeWidth={1.5} />
          </div>
        )}
        <span className="absolute top-3 left-3">
          <Badge color={availabilityColor[p.availability]} className="bg-surface/95 backdrop-blur">
            {availabilityLabel[p.availability]}
          </Badge>
        </span>
        {p.images.length > 1 && (
          <span className="absolute bottom-2 right-3 text-[11px] font-medium text-white bg-ink/60 rounded-full px-2 py-0.5">
            {p.images.length} photos
          </span>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-[15px] text-ink leading-snug truncate">{p.title}</h3>
            <p className="flex items-center gap-1 text-[12px] text-ink-faint mt-0.5">
              <MapPin size={11} /> {p.location ?? "—"}
            </p>
          </div>
          <p className="font-display font-bold text-primary whitespace-nowrap">{priceLabel}</p>
        </div>

        <div className="flex items-center gap-3 text-[12px] text-ink-soft mt-3">
          <span className="capitalize rounded-full bg-canvas px-2 py-0.5">{p.category}</span>
          {p.bedrooms != null && (
            <span className="flex items-center gap-1"><BedDouble size={13} /> {p.bedrooms}</span>
          )}
          {p.bathrooms != null && (
            <span className="flex items-center gap-1"><Bath size={13} /> {p.bathrooms}</span>
          )}
          {p.area != null && (
            <span className="flex items-center gap-1"><Ruler size={13} /> {p.area} sqft</span>
          )}
        </div>

        {p.amenities.length > 0 && (
          <p className="text-[12px] text-ink-faint mt-2 truncate">{p.amenities.join(" · ")}</p>
        )}

        {(canEdit || canDelete) && (
          <div className="flex items-center gap-1.5 mt-auto pt-3">
            {canEdit && (
              <PropertyFormButton
                categories={categories}
                property={p}
                trigger={
                  <Button variant="secondary" size="sm">
                    <Pencil size={13} /> Edit
                  </Button>
                }
              />
            )}
            {canDelete && (
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={13} className="text-accent-rose" />
              </Button>
            )}
          </div>
        )}
      </div>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete property?">
        <p className="text-sm text-ink-soft">
          <span className="font-medium text-ink">{p.title}</span> will be removed from the inventory
          (soft delete).
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button
            variant="danger"
            onClick={async () => {
              await deletePropertyAction(p.id);
              setConfirmDelete(false);
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
