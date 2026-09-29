import { Home } from "lucide-react";
import { requireUser, getOrgContext } from "@/server/session";
import { listProperties, type PropertyFilters } from "@/server/services/properties";
import { can } from "@/server/auth/permissions";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/format";
import { PropertyFiltersBar } from "./filters";
import { PropertyCard } from "./property-card";
import { PropertyFormButton } from "./property-form";

export const metadata = { title: "Properties" };

type Search = {
  category?: string;
  availability?: string;
  minPrice?: string;
  maxPrice?: string;
  beds?: string;
  q?: string;
};

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const filters: PropertyFilters = {
    category: sp.category,
    availability: sp.availability,
    minPrice: sp.minPrice ? Number(sp.minPrice) : undefined,
    maxPrice: sp.maxPrice ? Number(sp.maxPrice) : undefined,
    bedrooms: sp.beds ? Number(sp.beds) : undefined,
    q: sp.q,
  };

  const [ctx, properties] = await Promise.all([
    getOrgContext(user.orgId),
    listProperties(user, filters),
  ]);
  const { currency, locale } = ctx.org;
  const categories = ctx.propertyCategories.map((c) => ({ value: c.value, label: c.label }));
  const canEdit = can(user.role, "property", "update");
  const canDelete = can(user.role, "property", "delete");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Properties Inventory</h1>
          <p className="text-sm text-ink-faint mt-0.5">{properties.length} properties</p>
        </div>
        {can(user.role, "property", "create") && <PropertyFormButton categories={categories} />}
      </div>

      <PropertyFiltersBar categories={categories} />

      {properties.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Home size={20} />}
            title="No properties match"
            hint="Adjust the filters or add a property to the inventory."
          />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {properties.map((p) => (
            <PropertyCard
              key={p.id}
              property={p}
              priceLabel={formatCurrency(p.price, currency, locale, { compact: true })}
              categories={categories}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
