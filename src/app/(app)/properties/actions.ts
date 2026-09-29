"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/session";
import {
  createProperty,
  deleteProperty,
  updateProperty,
  type PropertyInput,
} from "@/server/services/properties";

const propertySchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  price: z.coerce.number().positive("Price must be positive"),
  area: z.coerce.number().positive().optional().or(z.literal("")),
  location: z.string().optional(),
  bedrooms: z.coerce.number().int().min(0).optional().or(z.literal("")),
  bathrooms: z.coerce.number().int().min(0).optional().or(z.literal("")),
  amenities: z.string().optional(),
  availability: z.enum(["AVAILABLE", "UNDER_CONSTRUCTION", "SOLD", "RESERVED"]).optional(),
});

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

async function saveImages(formData: FormData): Promise<string[]> {
  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return [];
  await mkdir(UPLOAD_DIR, { recursive: true });
  const urls: string[] = [];
  for (const file of files.slice(0, 10)) {
    const ext = IMAGE_TYPES[file.type];
    if (!ext || file.size > MAX_IMAGE_BYTES) continue;
    const name = `${randomUUID()}${ext}`;
    await writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
    urls.push(`/uploads/${name}`);
  }
  return urls;
}

function parsePropertyForm(
  formData: FormData
): { ok: false; error: string } | { ok: true; data: Omit<PropertyInput, "images"> } {
  const raw = Object.fromEntries(formData.entries());
  const parsed = propertySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;
  return {
    ok: true,
    data: {
      title: d.title,
      description: d.description || null,
      category: d.category,
      price: d.price,
      area: d.area === "" || d.area === undefined ? null : d.area,
      location: d.location || null,
      bedrooms: d.bedrooms === "" || d.bedrooms === undefined ? null : d.bedrooms,
      bathrooms: d.bathrooms === "" || d.bathrooms === undefined ? null : d.bathrooms,
      amenities: (d.amenities ?? "")
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
      availability: d.availability,
    },
  };
}

export type PropertyFormState = { error: string } | undefined;

export async function createPropertyAction(
  _prev: PropertyFormState,
  formData: FormData
): Promise<PropertyFormState> {
  const user = await requireUser();
  const parsed = parsePropertyForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const images = await saveImages(formData);
  await createProperty(user, { ...parsed.data, images });
  revalidatePath("/properties");
}

export async function updatePropertyAction(
  id: string,
  keepImages: string[],
  _prev: PropertyFormState,
  formData: FormData
): Promise<PropertyFormState> {
  const user = await requireUser();
  const parsed = parsePropertyForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const newImages = await saveImages(formData);
  await updateProperty(user, id, { ...parsed.data, images: [...keepImages, ...newImages] });
  revalidatePath("/properties");
}

export async function deletePropertyAction(id: string) {
  const user = await requireUser();
  await deleteProperty(user, id);
  revalidatePath("/properties");
}
