import masterList from "./suppliers.json";

export interface Supplier {
  slug: string;
  company: string;
  website: string;
  phone: string;
  email: string;
  headOffice: string;
  areasCovered: string[];
  services: string[];
  description: string;
  featured: boolean;
  location?: string;
}

type SupplierRef = Partial<Supplier> & { slug: string };

interface CityFile {
  name: string;
  nation: string;
  region: string;
  description: string;
  intro?: string;
  published?: boolean;
  suppliers: (string | SupplierRef)[];
}

export interface City {
  slug: string;
  name: string;
  nation: string;
  region: string;
  description: string;
  intro: string;
  suppliers: Supplier[];
}

const master = masterList as Supplier[];

const cityFiles = import.meta.glob<CityFile>("./cities/*.json", {
  eager: true,
  import: "default",
});

function validate(city: string, s: Supplier) {
  const missing: string[] = [];
  if (!s.company) missing.push("company");
  if (!s.description) missing.push("description");
  if (!Array.isArray(s.services)) missing.push("services");
  if (!s.phone && !s.website) missing.push("phone or website");
  if (missing.length) {
    throw new Error(
      `[${city}] supplier "${s.slug}" is missing: ${missing.join(", ")}`
    );
  }
}

export function getCities(): City[] {
  const bySlug = new Map(master.map((s) => [s.slug, s]));

  return Object.entries(cityFiles)
    .map(([filePath, file]) => {
      const slug = filePath.replace("./cities/", "").replace(".json", "");

      for (const field of ["name", "nation", "region", "description"] as const) {
        if (!file[field]) {
          throw new Error(`[${slug}] city file is missing "${field}"`);
        }
      }

      const suppliers = file.suppliers.map((ref) => {
        const override: SupplierRef = typeof ref === "string" ? { slug: ref } : ref;
        const base = bySlug.get(override.slug);

        if (!base) {
          throw new Error(
            `[${slug}] unknown supplier "${override.slug}". Add it to src/data/suppliers.json`
          );
        }

        const merged = { ...base, ...override } as Supplier;
        validate(slug, merged);
        return merged;
      });

      return {
        slug,
        name: file.name,
        nation: file.nation,
        region: file.region,
        description: file.description,
        intro: file.intro ?? "",
        suppliers,
        published: file.published !== false,
      };
    })
    .filter((city) => city.published)
    .map(({ published, ...city }) => city)
    .sort((a, b) => a.name.localeCompare(b.name));
}

const NATION_ORDER = ["England", "Scotland", "Wales", "Northern Ireland"];
const rank = (n: string) => {
  const i = NATION_ORDER.indexOf(n);
  return i === -1 ? 99 : i;
};

export function groupCities(cities: City[]) {
  const nations = new Map<string, Map<string, City[]>>();

  for (const city of cities) {
    if (!nations.has(city.nation)) nations.set(city.nation, new Map());
    const regions = nations.get(city.nation)!;
    if (!regions.has(city.region)) regions.set(city.region, []);
    regions.get(city.region)!.push(city);
  }

  return [...nations.entries()]
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([nation, regions]) => ({
      nation,
      regions: [...regions.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([region, list]) => ({ region, cities: list })),
    }));
}