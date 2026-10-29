// Free, instant fit score between his CV/profile and a job ad (no API calls).
// Claude can add a deeper check on top for the shortlist.
import { cefrIndex } from "./metrics";
import type { LocalFit, Profile, ResumeParsed } from "./types";

// Supply-chain vocabulary in English and German, grouped by sub-field.
export const DOMAIN_TERMS: Record<string, string[]> = {
  "supply chain": ["supply chain", "scm", "lieferkette", "supply-chain"],
  planning: ["demand planning", "demand planner", "bedarfsplanung", "s&op", "sales and operations", "forecast", "prognose", "disposition", "disponent", "materialplanung", "production planning", "produktionsplanung", "planner", "planer"],
  procurement: ["procurement", "purchasing", "einkauf", "einkäufer", "beschaffung", "sourcing", "buyer", "lieferantenmanagement", "supplier management", "category"],
  logistics: ["logistics", "logistik", "warehouse", "lager", "lagerlogistik", "transport", "shipping", "versand", "spedition", "freight", "fracht", "distribution", "intralogistik", "zoll", "customs"],
  inventory: ["inventory", "bestand", "bestandsmanagement", "materialwirtschaft", "stock", "replenishment", "nachschub"],
  operations: ["operations", "operativ", "fulfillment", "fulfilment", "order management", "auftragsabwicklung", "kpi", "otif", "lean", "continuous improvement"],
  analytics: ["analyst", "analytics", "power bi", "tableau", "sql", "python", "data", "reporting", "controlling"],
  systems: ["sap", "s/4hana", "sap mm", "sap sd", "erp", "wms", "tms", "excel", "dynamics", "oracle"],
};

const ENTRY = /\b(junior|trainee\w*|graduate|absolvent\w*|berufseinsteiger\w*|einsteiger\w*|entry[- ]level|werkstudent\w*|praktik\w*|internship|intern|working student|young professional|direkteinstieg)\b/i;
const SENIOR = /\b(senior|lead|head of|leiter\w*|leitung|director|teamleit\w*|principal|mehrjährige|([5-9]|10)\+? (years|jahre))\b/i;
const GERMAN_STOP = /\b(und|der|die|das|wir|sie|mit|für|ihre|unser|bei|auf|eine|einen|zur|zum|von)\b/gi;

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ");
}

/** CEFR level the ad asks for (explicit or implied by wording/ad language). */
export function germanRequirement(text: string): string {
  const t = norm(text);
  const explicit = t.match(/deutsch[^.\n]{0,60}?\b([abc][12])\b|\b([abc][12])\b[^.\n]{0,40}deutsch|german[^.\n]{0,40}?\b([abc][12])\b|\b([abc][12])\b[^.\n]{0,30}german/);
  if (explicit) return (explicit[1] || explicit[2] || explicit[3] || explicit[4]).toUpperCase();
  if (/(no german (is )?(required|needed|necessary)|german (language )?(is )?not (required|needed|necessary)|without german|deutschkenntnisse (sind )?nicht erforderlich|keine deutschkenntnisse)/.test(t)) return "none";
  if (/(verhandlungssicher|fließend|fliessend|muttersprach|native german|fluent german|fluent in german|business fluent german|exzellente deutsch|sehr gute deutsch|sehr gute kenntnisse der deutschen)/.test(t)) return "C1";
  if (/(gute deutschkenntnisse|good german|gute kenntnisse der deutschen|german skills|deutschkenntnisse)/.test(t)) return "B2";
  if (/(german is a plus|german is an advantage|basic german|grundkenntnisse)/.test(t)) return "A2";
  const words = t.split(" ").length;
  const de = (t.match(GERMAN_STOP) ?? []).length;
  if (words > 80 && de / words > 0.06) return "B2"; // ad written in German
  if (/(english|englisch)/.test(t) && words > 80) return "unknown";
  return "unknown";
}

export function seniorityOf(title: string, text: string): LocalFit["seniority"] {
  if (ENTRY.test(title)) return "entry";
  if (SENIOR.test(title)) return "senior";
  if (ENTRY.test(text.slice(0, 3000))) return "entry";
  if (SENIOR.test(text.slice(0, 3000))) return "senior";
  return "mid";
}

function cvTerms(cv: ResumeParsed | null, profile: Profile): string[] {
  if (!cv) return [];
  const raw = [...cv.skills, ...cv.tools, ...cv.certifications, ...cv.experience.map((e) => e.title)];
  const set = new Set<string>();
  for (const r of raw) {
    for (const part of r.split(/[,/;|()]/)) {
      const p = norm(part).trim();
      if (p.length >= 2 && p.length <= 40) set.add(p);
    }
  }
  for (const r of profile.targetRoles.split(/[,;]/)) {
    const p = norm(r).trim();
    if (p) set.add(p);
  }
  return [...set];
}

function contains(text: string, term: string) {
  if (term.length <= 3) return new RegExp(`(^|[^a-z0-9äöüß])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9äöüß]|$)`).test(text);
  return text.includes(term);
}

export function localFit(
  job: { title: string; description: string; location: string; remote: boolean },
  cv: ResumeParsed | null,
  profile: Profile,
): LocalFit {
  const title = norm(job.title);
  const text = norm(`${job.title} ${job.description}`);
  const reasons: string[] = [];
  const flags: string[] = [];

  // 1. Domain: how many supply-chain sub-fields appear (title counts double).
  const hitFields = Object.entries(DOMAIN_TERMS).filter(([, terms]) => terms.some((t) => contains(text, t)));
  // Only core supply-chain fields count for the title; tools/analytics alone don't make it an SCM role.
  const CORE = ["supply chain", "planning", "procurement", "logistics", "inventory", "operations"];
  const titleHit = CORE.some((k) => DOMAIN_TERMS[k].some((t) => contains(title, t)));
  const domain = Math.min(100, hitFields.length * 18 + (titleHit ? 40 : 0));
  if (titleHit) reasons.push("Supply-chain role by title");
  else if (hitFields.length) reasons.push(`Touches ${hitFields.map(([k]) => k).slice(0, 3).join(", ")}`);
  else flags.push("Not clearly a supply-chain role");

  // 2. His CV skills/tools mentioned in the ad.
  const terms = cvTerms(cv, profile);
  const matched = terms.filter((t) => contains(text, t)).slice(0, 12);
  const skills = terms.length ? Math.min(100, Math.round((matched.length / Math.min(terms.length, 10)) * 100)) : 50;
  if (matched.length) reasons.push(`Matches your ${matched.slice(0, 4).join(", ")}`);

  // 3. Seniority.
  const seniority = seniorityOf(job.title, job.description);
  const senScore = seniority === "entry" ? 100 : seniority === "mid" ? 65 : 15;
  if (seniority === "entry") reasons.push("Entry-level / graduate friendly");
  if (seniority === "senior") flags.push("Senior role, likely needs years of experience");

  // 4. German requirement vs his level.
  const germanNeeded = germanRequirement(`${job.title}\n${job.description}`);
  const his = cefrIndex(profile.germanLevel);
  const need = cefrIndex(germanNeeded);
  const germanGap = his >= 0 && need >= 0 ? Math.max(0, need - his) : 0;
  const germanScore = germanNeeded === "none" ? 100 : need < 0 ? 75 : his < 0 ? 60 : germanGap === 0 ? 100 : germanGap === 1 ? 45 : 5;
  if (need >= 0 && his >= 0 && germanGap === 0) reasons.push(`Your German (${profile.germanLevel}) meets ${germanNeeded}`);
  if (germanGap === 1) flags.push(`Needs German ${germanNeeded}; you're one level below`);
  if (germanGap >= 2) flags.push(`Needs German ${germanNeeded}; a big gap from ${profile.germanLevel}`);
  if (need < 0) reasons.push("No explicit German requirement found");

  // 5. Location.
  const cities = profile.targetCities.split(/[,;]/).map((c) => norm(c).trim()).filter(Boolean);
  const loc = norm(job.location);
  const cityHit = cities.some((c) => loc.includes(c));
  const locScore = !cities.length ? 70 : cityHit ? 100 : job.remote ? 85 : 35;
  if (cityHit) reasons.push(`In ${job.location}`);
  else if (job.remote) reasons.push("Remote possible");
  else if (cities.length) flags.push(`Outside your target cities (${job.location || "location unknown"})`);

  const score = Math.round(domain * 0.35 + skills * 0.2 + senScore * 0.15 + germanScore * 0.2 + locScore * 0.1);
  return { score, domain, skills, seniority, germanNeeded, germanGap, matched, reasons, flags };
}

const FOREIGN = /\b(uk|netherlands|nederland|holland|amsterdam|rotterdam|austria|österreich|wien|vienna|switzerland|schweiz|zürich|zurich|united kingdom|london|france|paris|spain|españa|madrid|barcelona|poland|polska|warsaw|italy|milan|belgium|brussels|denmark|copenhagen|sweden|stockholm|czech|prague|portugal|lisbon|ireland|dublin|usa|united states)\b/i;

const REMOTE = /\b(remote|fully remote|100 ?% remote|work from home|home ?office|homeoffice|mobiles arbeiten|mobile arbeit|ortsunabhängig|anywhere)\b/i;

/** Remote/home-office jobs: from the board's flag, or the title/location/tags/text saying so. */
export function isRemote(flag: boolean, ...texts: string[]) {
  return flag || texts.some((t) => REMOTE.test(t));
}

/** True when the ad's location is clearly outside Germany (he needs a German work permit). */
export function outsideGermany(location: string) {
  return FOREIGN.test(location) && !/germany|deutschland/i.test(location);
}

/** Remote roles he can take from Germany: open to Germany, the EU/Europe or anywhere, not locked to another country. */
export function remoteFromGermany(location: string, title = "") {
  const text = `${location} ${title}`;
  if (/germany|deutschland|\b(eu|europe|european union|emea|worldwide|anywhere|global)\b/i.test(text)) return true;
  return !outsideGermany(text);
}

export function htmlToText(html: string) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|li|div|h\d|br)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}
