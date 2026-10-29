// General mock interviews: no job ad needed. The interviewer plays a recruiter or manager at one of
// these companies (largest logistics providers + supply-chain leaders, weighted to ones hiring in Germany).
import type { Competency, Job } from "./types";

export interface Company {
  id: string;
  name: string;
  kind: string;
  hq: string;
  germany: string;
  about: string;
  focus: string;
}

export const COMPANIES: Company[] = [
  { id: "dhl", name: "DHL Group", kind: "Logistics provider", hq: "Bonn, Germany", germany: "Headquarters; sites across Germany", about: "The world's largest logistics company: express, freight forwarding, contract logistics (DHL Supply Chain), e-commerce and German post & parcel.", focus: "Operational excellence, warehouse and network KPIs, customer focus, working across divisions and countries." },
  { id: "kuehne-nagel", name: "Kuehne+Nagel", kind: "Freight forwarder", hq: "Schindellegi, Switzerland", germany: "Founded in Bremen; large Hamburg and Bremen operations", about: "One of the largest sea and air freight forwarders, also road logistics and contract logistics.", focus: "Sea/air freight basics, Incoterms, customs, rates and margins, customer service under pressure." },
  { id: "dsv", name: "DSV (incl. DB Schenker)", kind: "Freight forwarder", hq: "Hedehusene, Denmark", germany: "Big German footprint through DB Schenker", about: "Asset-light transport and logistics group; acquired DB Schenker, making it one of the biggest forwarders worldwide.", focus: "Integration and change, cost discipline, road/air/sea solutions, data-driven operations." },
  { id: "maersk", name: "A.P. Moller-Maersk", kind: "Container shipping & logistics", hq: "Copenhagen, Denmark", germany: "Offices incl. Hamburg", about: "Container shipping line turning into an end-to-end integrated logistics provider.", focus: "End-to-end supply chains, customer solutions beyond ocean freight, disruption handling (canals, ports, capacity)." },
  { id: "msc", name: "MSC", kind: "Container shipping", hq: "Geneva, Switzerland", germany: "Offices incl. Hamburg and Bremen", about: "The largest container shipping line by capacity, family-owned, also terminals and logistics.", focus: "Shipping fundamentals, schedule reliability, equipment and capacity planning, commercial sense." },
  { id: "cma-cgm", name: "CMA CGM / CEVA Logistics", kind: "Container shipping & logistics", hq: "Marseille, France", germany: "CEVA contract-logistics sites in Germany", about: "Major container line that owns CEVA Logistics for contract logistics and forwarding.", focus: "Contract logistics operations, warehouse productivity, cross-functional projects." },
  { id: "hapag-lloyd", name: "Hapag-Lloyd", kind: "Container shipping", hq: "Hamburg, Germany", germany: "Headquarters in Hamburg", about: "One of the world's largest container lines, German-headquartered.", focus: "Network and equipment planning, pricing and yield, cost per container, analytical rigour." },
  { id: "ups", name: "UPS", kind: "Parcel & logistics", hq: "Atlanta, USA", germany: "European air hub at Cologne/Bonn", about: "Global parcel, freight and supply-chain solutions company.", focus: "Network efficiency, safety, hub operations, process improvement with data." },
  { id: "fedex", name: "FedEx", kind: "Parcel & logistics", hq: "Memphis, USA", germany: "Operations across Germany", about: "Global express transportation, e-commerce and business services.", focus: "Service reliability, on-time performance, customer experience, cost efficiency." },
  { id: "expeditors", name: "Expeditors", kind: "Freight forwarder", hq: "Seattle, USA", germany: "Offices incl. Frankfurt and Hamburg", about: "Non-asset-based global logistics: air and ocean freight, customs brokerage, supply-chain solutions.", focus: "Customs and compliance, attention to detail, customer accounts, long-term career growth." },
  { id: "ch-robinson", name: "C.H. Robinson", kind: "Freight broker & forwarder", hq: "Eden Prairie, USA", germany: "European operations", about: "One of the largest third-party logistics providers, strong in freight brokerage and technology.", focus: "Sales and negotiation, carrier management, pricing, tech-enabled logistics." },
  { id: "nippon-express", name: "NX (Nippon Express)", kind: "Logistics provider", hq: "Tokyo, Japan", germany: "Offices and warehouses incl. Düsseldorf area", about: "Japan's largest logistics company: forwarding, warehousing, heavy-haul.", focus: "Quality and precision, serving Japanese manufacturers in Europe, teamwork." },
  { id: "geodis", name: "GEODIS", kind: "Logistics provider", hq: "Paris area, France", germany: "Contract-logistics and road sites in Germany", about: "Global logistics provider owned by SNCF: contract logistics, freight forwarding, road transport.", focus: "Warehouse operations, continuous improvement, client KPIs and SLAs." },
  { id: "dachser", name: "Dachser", kind: "Logistics provider", hq: "Kempten, Germany", germany: "Headquarters; dense German network", about: "Family-owned logistics provider: European road logistics, air & sea, food logistics, contract logistics.", focus: "Network thinking, reliability, long-term family-company values, German language in operations." },
  { id: "rhenus", name: "Rhenus", kind: "Logistics provider", hq: "Holzwickede, Germany", germany: "Headquarters; sites across Germany", about: "Family-owned logistics group: contract logistics, freight, port logistics, public transport.", focus: "Hands-on operations, customer solutions, entrepreneurial attitude." },
  { id: "amazon", name: "Amazon", kind: "Supply-chain leader", hq: "Seattle, USA", germany: "Fulfilment centres and offices across Germany", about: "Runs one of the world's largest fulfilment and transportation networks.", focus: "Behavioural questions mapped to Amazon's Leadership Principles (customer obsession, ownership, dive deep, deliver results); data-heavy STAR answers with metrics." },
  { id: "siemens", name: "Siemens", kind: "Industrial supply-chain leader", hq: "Munich, Germany", germany: "Headquarters; plants and offices across Germany", about: "Industrial technology company with a large global procurement and supply-chain organisation.", focus: "Procurement and supplier management, resilience, digitalisation of supply chains, structured problem solving." },
  { id: "schneider", name: "Schneider Electric", kind: "Supply-chain leader", hq: "Rueil-Malmaison, France", germany: "Offices and plants in Germany", about: "Energy-management company repeatedly ranked at the top of Gartner's Supply Chain Top 25.", focus: "End-to-end supply chain, sustainability, demand-supply balancing, digital tools." },
  { id: "unilever", name: "Unilever", kind: "FMCG supply-chain leader", hq: "London, UK", germany: "Offices and factories in Germany", about: "Consumer-goods company known for a large, sustainability-focused supply chain.", focus: "Demand planning, customer service levels, sustainability, leadership potential." },
  { id: "pg", name: "Procter & Gamble", kind: "FMCG supply-chain leader", hq: "Cincinnati, USA", germany: "German HQ near Frankfurt; plants in Germany", about: "Consumer-goods company with a highly regarded planning and supply-network organisation.", focus: "Leadership examples, problem solving with data, planning and supply-network operations." },
];

export const GENERAL_ROLES = [
  { id: "analyst", title: "Supply Chain Analyst", competencies: ["motivation_fit", "cv_walkthrough", "analytical_data", "supply_chain_planning", "erp_tools", "problem_solving", "hygiene"] },
  { id: "planner", title: "Demand / Supply Planner", competencies: ["motivation_fit", "cv_walkthrough", "supply_chain_planning", "analytical_data", "stakeholder_management", "erp_tools", "hygiene"] },
  { id: "procurement", title: "Procurement Specialist / Buyer", competencies: ["motivation_fit", "cv_walkthrough", "procurement_supplier", "stakeholder_management", "communication", "problem_solving", "hygiene"] },
  { id: "logistics", title: "Logistics / Operations Specialist", competencies: ["motivation_fit", "cv_walkthrough", "logistics_operations", "problem_solving", "leadership_ownership", "erp_tools", "hygiene"] },
  { id: "graduate", title: "Graduate / Trainee Programme (Supply Chain)", competencies: ["motivation_fit", "cv_walkthrough", "communication", "problem_solving", "leadership_ownership", "analytical_data", "hygiene"] },
] as const satisfies readonly { id: string; title: string; competencies: readonly Competency[] }[];

export type GeneralRoleId = (typeof GENERAL_ROLES)[number]["id"];

/** A reusable practice track for "general interview at <company> for <role>" — shaped like a job ad. */
export function generalJob(companyId: string, roleId: string, id: string): Job | null {
  const c = COMPANIES.find((x) => x.id === companyId);
  const r = GENERAL_ROLES.find((x) => x.id === roleId);
  if (!c || !r) return null;
  return {
    id,
    createdAt: new Date().toISOString(),
    source: "text",
    url: "",
    general: { companyId: c.id, roleId: r.id },
    rawText: `General interview (no specific job ad): ${r.title} at ${c.name}.\n${c.about}\nIn Germany: ${c.germany}.\nWhat interviewers there tend to probe: ${c.focus}`,
    parsed: {
      company: c.name,
      title: `${r.title} (general)`,
      seniority: "entry / junior",
      location: c.germany,
      workModel: "",
      adLanguage: "en",
      summary: `General ${r.title} interview at ${c.name} (${c.kind}, HQ ${c.hq}). ${c.about}`,
      mustHave: [],
      niceToHave: [],
      tools: [],
      germanRequired: { stated: "", implied: "Depends on the team; operations roles in Germany often need B1-B2+", reasoning: "No specific ad" },
      englishRequired: "Business fluent",
      competencies: [...r.competencies],
      likelyQuestions: [],
      hygieneNotes: "",
    },
  };
}
