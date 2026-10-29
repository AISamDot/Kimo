// Regions the job finder can cover. The free boards (Arbeitnow, Adzuna DE) only list Germany;
// every other region comes from the Apify LinkedIn/Indeed scrape, run country by country.

export interface Country {
  name: string; // LinkedIn location string
  indeed?: string; // Indeed country code, when Indeed covers it
}

export const REGIONS = {
  germany: { label: "Germany", countries: [{ name: "Germany", indeed: "de" }] },
  europe: {
    label: "Rest of Europe",
    countries: [
      { name: "Netherlands", indeed: "nl" },
      { name: "United Kingdom", indeed: "uk" },
      { name: "Switzerland", indeed: "ch" },
      { name: "Austria", indeed: "at" },
      { name: "Belgium", indeed: "be" },
      { name: "France", indeed: "fr" },
      { name: "Poland", indeed: "pl" },
      { name: "Denmark", indeed: "dk" },
      { name: "Sweden", indeed: "se" },
      { name: "Ireland", indeed: "ie" },
      { name: "Spain", indeed: "es" },
      { name: "Italy", indeed: "it" },
    ],
  },
  gcc: {
    label: "GCC",
    countries: [
      { name: "United Arab Emirates", indeed: "ae" },
      { name: "Saudi Arabia", indeed: "sa" },
      { name: "Qatar", indeed: "qa" },
      { name: "Kuwait", indeed: "kw" },
      { name: "Bahrain", indeed: "bh" },
      { name: "Oman", indeed: "om" },
    ],
  },
  asia: {
    label: "Asia",
    countries: [
      { name: "Singapore", indeed: "sg" },
      { name: "Hong Kong", indeed: "hk" },
      { name: "Malaysia", indeed: "my" },
      { name: "India", indeed: "in" },
      { name: "Japan", indeed: "jp" },
      { name: "Vietnam", indeed: "vn" },
      { name: "Thailand", indeed: "th" },
    ],
  },
  africa: {
    label: "Africa",
    countries: [
      { name: "Egypt", indeed: "eg" },
      { name: "Morocco", indeed: "ma" },
      { name: "South Africa", indeed: "za" },
      { name: "Nigeria", indeed: "ng" },
      { name: "Kenya" },
    ],
  },
} satisfies Record<string, { label: string; countries: Country[] }>;

export type RegionId = keyof typeof REGIONS;
export const REGION_IDS = Object.keys(REGIONS) as RegionId[];

export const isRegionId = (x: unknown): x is RegionId => typeof x === "string" && x in REGIONS;

/** Countries to scrape for the chosen regions, each tagged with its region. */
export function countriesFor(regions: RegionId[]): (Country & { region: RegionId })[] {
  return regions.flatMap((r) => REGIONS[r].countries.map((c) => ({ ...c, region: r })));
}

/** Operations / supply-chain / logistics title terms; LinkedIn results must match one. */
export const SECTOR_TITLE_TERMS = [
  "supply chain", "logistics", "procurement", "purchasing", "buyer", "sourcing", "operations", "planner", "planning",
  "inventory", "warehouse", "fulfilment", "fulfillment", "transport", "freight", "shipping", "distribution", "materials",
  "demand", "S&OP", "import", "export", "customs", "category manager", "Einkauf", "Logistik", "Disposition",
];
