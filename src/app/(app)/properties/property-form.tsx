"use client";

import { useActionState, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import type { SerializedProperty } from "@/server/services/properties";
import { createPropertyAction, updatePropertyAction, type PropertyFormState } from "./actions";

type Option = { value: string; label: string };

export function PropertyFormButton({
  categories,
  property,
  trigger,
}: {
  categories: Option[];
  property?: SerializedProperty;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [keepImages, setKeepImages] = useState<string[]>(property?.images ?? []);

  const action = property
    ? updatePropertyAction.bind(null, property.id, keepImages)
    : createPropertyAction;
  const [state, formAction, pending] = useActionState<PropertyFormState, FormData>(
    async (prev, formData) => {
      const result = await action(prev, formData);
      if (!result) setOpen(false);
      return result;
    },
    undefined
  );

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus size={15} /> Add Property
        </Button>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={property ? "Edit Property" : "Create New Property"}
        wide
      >
        <form action={formAction} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Title *">
                <Input name="title" required defaultValue={property?.title} placeholder="e.g. Skyline Heights 3BHK" />
              </Field>
            </div>
            <Field label="Category *">
              <Select name="category" required defaultValue={property?.category ?? ""}>
                <option value="" disabled>Select category</option>
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Price *">
              <Input name="price" type="number" min="0" required defaultValue={property?.price} />
            </Field>
            <Field label="Location">
              <Input name="location" defaultValue={property?.location ?? ""} placeholder="Area, City" />
            </Field>
            <Field label="Area (sqft)">
              <Input name="area" type="number" min="0" defaultValue={property?.area ?? ""} />
            </Field>
            <Field label="Bedrooms">
              <Input name="bedrooms" type="number" min="0" defaultValue={property?.bedrooms ?? ""} />
            </Field>
            <Field label="Bathrooms">
              <Input name="bathrooms" type="number" min="0" defaultValue={property?.bathrooms ?? ""} />
            </Field>
            <Field label="Availability">
              <Select name="availability" defaultValue={property?.availability ?? "AVAILABLE"}>
                <option value="AVAILABLE">Available</option>
                <option value="UNDER_CONSTRUCTION">Under construction</option>
                <option value="RESERVED">Reserved</option>
                <option value="SOLD">Sold</option>
              </Select>
            </Field>
            <Field label="Amenities (comma separated)">
              <Input name="amenities" defaultValue={property?.amenities.join(", ") ?? ""} placeholder="Gym, Pool, Parking" />
            </Field>
          </div>
          <Field label="Description">
            <Textarea name="description" defaultValue={property?.description ?? ""} />
          </Field>

          {keepImages.length > 0 && (
            <div>
              <p className="text-[13px] font-medium text-ink-soft mb-1.5">Current photos</p>
              <div className="flex flex-wrap gap-2">
                {keepImages.map((src) => (
                  <span key={src} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="size-16 rounded-lg object-cover border border-line" />
                    <button
                      type="button"
                      onClick={() => setKeepImages((imgs) => imgs.filter((i) => i !== src))}
                      className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-ink text-white cursor-pointer"
                      aria-label="Remove photo"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <Field label={property ? "Add photos" : "Photos"}>
            <input
              type="file"
              name="images"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-primary-soft file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary file:cursor-pointer"
            />
          </Field>

          {state?.error && (
            <p className="text-sm text-accent-rose bg-accent-rose/10 rounded-xl px-3 py-2">{state.error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : property ? "Save changes" : "Create Property"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
