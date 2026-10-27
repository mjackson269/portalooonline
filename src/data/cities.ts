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

export interface City {
  name: string;
  slug: string;
  region: string;
  description: string;
}

const cityList: City[] = [
  {
    name: "Bradford",
    slug: "bradford",
    region: "West Yorkshire",
    description:
      "Compare portable toilet suppliers serving Bradford and the surrounding West Yorkshire area.",
  },
  {
    name: "Leeds",
    slug: "leeds",
    region: "West Yorkshire",
    description:
      "Find portable toilet, event toilet and welfare unit suppliers serving Leeds.",
  },
  {
    name: "Sheffield",
    slug: "sheffield",
    region: "South Yorkshire",
    description:
      "Browse portable toilet hire companies covering Sheffield and South Yorkshire.",
  },
  {
    name: "York",
    slug: "york",
    region: "North Yorkshire",
    description:
      "Compare site, event and luxury toilet hire companies serving York.",
  },
  {
    name: "Hull",
    slug: "hull",
    region: "East Yorkshire",
    description:
      "Find portable toilet and welfare facility suppliers covering Hull and the East Riding.",
  },
];

const files = import.meta.glob<{ default: Supplier[] }>(
  "./suppliers/*.json",
  { eager: true }
);

export function getCities() {
  return cityList.map((city) => {
    const file = files[`./suppliers/${city.slug}.json`];

    if (!file) {
      throw new Error(
        `Missing data file: src/data/suppliers/${city.slug}.json`
      );
    }

    return { ...city, suppliers: file.default };
  });
}