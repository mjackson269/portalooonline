import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const oldDir = path.join(root, "src", "data", "suppliers");
const citiesDir = path.join(root, "src", "data", "cities");
const masterFile = path.join(root, "src", "data", "suppliers.json");

const NATION = "England";

const cityMeta = {
  bradford: {
    name: "Bradford",
    region: "West Yorkshire",
    description:
      "Compare portable toilet suppliers serving Bradford and the surrounding West Yorkshire area.",
  },
  hull: {
    name: "Hull",
    region: "East Yorkshire",
    description:
      "Find portable toilet and welfare facility suppliers covering Hull and the East Riding.",
  },
  leeds: {
    name: "Leeds",
    region: "West Yorkshire",
    description:
      "Find portable toilet, event toilet and welfare unit suppliers serving Leeds.",
  },
  sheffield: {
    name: "Sheffield",
    region: "South Yorkshire",
    description:
      "Browse portable toilet hire companies covering Sheffield and South Yorkshire.",
  },
  york: {
    name: "York",
    region: "North Yorkshire",
    description:
      "Compare site, event and luxury toilet hire companies serving York.",
  },
};

const FIELDS = [
  "company", "website", "phone", "email", "headOffice",
  "areasCovered", "services", "description", "featured", "location",
];
// Fields that should be the same everywhere; differences are reported for you to resolve.
const SHARED_FIELDS = ["company", "phone", "email", "headOffice"];

const slugify = (s) =>
  String(s).toLowerCase().replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const isEmpty = (v) =>
  v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

const norm = (field, v) => {
  if (field === "phone") return String(v).replace(/\s+/g, "");
  if (field === "company")
    return String(v).toLowerCase()
      .replace(/\b(ltd|limited)\b\.?/g, "").replace(/[^a-z0-9]+/g, "");
  return JSON.stringify(v);
};

const missingFields = (s) => {
  const m = [];
  if (!s.company) m.push("company");
  if (!s.description) m.push("description");
  if (!Array.isArray(s.services)) m.push("services");
  if (!s.phone && !s.website) m.push("phone or website");
  return m;
};

if (!fs.existsSync(oldDir)) {
  console.error("Cannot find " + oldDir);
  process.exit(1);
}
if (
  fs.existsSync(masterFile) ||
  (fs.existsSync(citiesDir) && fs.readdirSync(citiesDir).length)
) {
  console.error("suppliers.json or src/data/cities already exists. Stopping so nothing is overwritten.");
  process.exit(1);
}

const warnings = [];
const loaded = [];

for (const file of fs.readdirSync(oldDir).filter((f) => f.endsWith(".json")).sort()) {
  const citySlug = path.basename(file, ".json");
  if (!cityMeta[citySlug]) {
    warnings.push(`${file}: no entry for "${citySlug}" in cityMeta. Skipped.`);
    continue;
  }
  let list;
  try {
    const raw = fs.readFileSync(path.join(oldDir, file), "utf8").replace(/^\uFEFF/, "");
    list = JSON.parse(raw);
  } catch (e) {
    warnings.push(`${file}: invalid JSON (${e.message}). Skipped.`);
    continue;
  }
  if (!Array.isArray(list)) {
    warnings.push(`${file}: expected an array of suppliers. Skipped.`);
    continue;
  }
  const entries = [];
  list.forEach((s, i) => {
    const slug = s.slug || slugify(s.company || "");
    if (!slug) {
      warnings.push(`${file} #${i}: no slug or company name. Skipped.`);
      return;
    }
    entries.push({ ...s, slug });
  });
  // How complete is this city's data? Complete cities go first so the master
  // list is built from the fullest version of each supplier.
  const score =
    entries.reduce((n, s) => n + (missingFields(s).length === 0 ? 1 : 0), 0) /
    Math.max(entries.length, 1);
  loaded.push({ citySlug, entries, score });
}

loaded.sort((a, b) => b.score - a.score || a.citySlug.localeCompare(b.citySlug));

const master = new Map();
const seenIn = new Map();
const cityRefs = {};
const conflicts = [];

for (const { citySlug, entries } of loaded) {
  cityRefs[citySlug] = [];

  for (const entry of entries) {
    const slug = entry.slug;

    if (!master.has(slug)) {
      master.set(slug, { ...entry });
      seenIn.set(slug, [citySlug]);
      cityRefs[citySlug].push(slug);
      continue;
    }

    const base = master.get(slug);
    seenIn.get(slug).push(citySlug);
    const overrides = {};

    for (const f of FIELDS) {
      if (isEmpty(entry[f])) continue;
      if (isEmpty(base[f])) {
        base[f] = entry[f];
        continue;
      }
      if (norm(f, base[f]) !== norm(f, entry[f])) {
        overrides[f] = entry[f];
        if (SHARED_FIELDS.includes(f)) {
          conflicts.push(
            `${slug} ${f}: ${JSON.stringify(base[f])} (${seenIn.get(slug)[0]}) vs ${JSON.stringify(entry[f])} (${citySlug})`
          );
        }
      }
    }

    cityRefs[citySlug].push(
      Object.keys(overrides).length ? { slug, ...overrides } : slug
    );
  }
}

// Cities that contain an incomplete supplier are written as unpublished,
// so the site still builds. Fix the data, then flip published to true.
const incomplete = new Map();
for (const [slug, s] of master) {
  const m = missingFields(s);
  if (m.length) incomplete.set(slug, m);
}
const holdBack = new Set();
for (const [citySlug, refs] of Object.entries(cityRefs)) {
  for (const ref of refs) {
    const slug = typeof ref === "string" ? ref : ref.slug;
    if (incomplete.has(slug)) holdBack.add(citySlug);
  }
}

fs.mkdirSync(citiesDir, { recursive: true });

for (const [citySlug, refs] of Object.entries(cityRefs)) {
  const meta = cityMeta[citySlug];
  const out = {
    name: meta.name,
    nation: NATION,
    region: meta.region,
    description: meta.description,
    intro: "",
    published: !holdBack.has(citySlug),
    suppliers: refs,
  };
  fs.writeFileSync(
    path.join(citiesDir, citySlug + ".json"),
    JSON.stringify(out, null, 2) + "\n"
  );
}

const sorted = [...master.values()].sort((a, b) =>
  String(a.company).localeCompare(String(b.company))
);
fs.writeFileSync(masterFile, JSON.stringify(sorted, null, 2) + "\n");

console.log(`\nCities written: ${Object.keys(cityRefs).length}`);
console.log(`Unique suppliers: ${master.size}`);

const shared = [...seenIn.entries()].filter(([, c]) => c.length > 1);
if (shared.length) {
  console.log(`\nSuppliers listed in more than one city (${shared.length}):`);
  shared.forEach(([slug, c]) => console.log(`  ${slug}: ${c.join(", ")}`));
}

if (conflicts.length) {
  console.log("\nSame supplier, different details. Pick the right value in suppliers.json:");
  conflicts.forEach((c) => console.log("  " + c));
}

if (incomplete.size) {
  console.log("\nSuppliers still missing required fields (add them in suppliers.json):");
  for (const [slug, m] of incomplete) {
    console.log(`  ${slug} [${seenIn.get(slug).join(", ")}]: ${m.join(", ")}`);
  }
}

if (holdBack.size) {
  console.log(
    `\nSet to "published": false until fixed: ${[...holdBack].join(", ")}`
  );
}

if (warnings.length) {
  console.log("\nWarnings:");
  warnings.forEach((w) => console.log("  " + w));
}
console.log("");