import type { Competency, PlanQuestion } from "./types";

// Curated core bank for supply-chain interviews in Germany. The session planner
// picks from here plus questions generated from the job ad and CV, and always
// rephrases so answers can't be memorised word for word.
export interface BankQuestion {
  id: string;
  competency: Competency;
  kind: PlanQuestion["kind"];
  en: string;
  de: string;
}

export const QUESTION_BANK: BankQuestion[] = [
  { id: "o1", competency: "cv_walkthrough", kind: "opening", en: "Tell me about yourself and walk me through your CV.", de: "Erzählen Sie mir etwas über sich und führen Sie mich durch Ihren Lebenslauf." },
  { id: "o2", competency: "motivation_fit", kind: "motivation", en: "Why did you apply for this role, and why our company?", de: "Warum haben Sie sich auf diese Stelle beworben, und warum bei uns?" },
  { id: "o3", competency: "motivation_fit", kind: "motivation", en: "Why Germany, and why do you want to build your career here?", de: "Warum Deutschland, und warum möchten Sie hier Ihre Karriere aufbauen?" },
  { id: "o4", competency: "motivation_fit", kind: "motivation", en: "Why supply chain? What draws you to this field?", de: "Warum Supply Chain? Was reizt Sie an diesem Bereich?" },
  { id: "o5", competency: "motivation_fit", kind: "motivation", en: "Where do you see yourself in five years?", de: "Wo sehen Sie sich in fünf Jahren?" },
  { id: "o6", competency: "motivation_fit", kind: "motivation", en: "What do you know about our company and our supply chain?", de: "Was wissen Sie über unser Unternehmen und unsere Lieferkette?" },
  { id: "b1", competency: "stakeholder_management", kind: "behavioral", en: "Tell me about a time you had a conflict with a supplier or colleague. How did you resolve it?", de: "Erzählen Sie von einem Konflikt mit einem Lieferanten oder Kollegen. Wie haben Sie ihn gelöst?" },
  { id: "b2", competency: "problem_solving", kind: "behavioral", en: "Describe a situation where a deadline was at risk. What did you do?", de: "Beschreiben Sie eine Situation, in der eine Deadline gefährdet war. Was haben Sie getan?" },
  { id: "b3", competency: "analytical_data", kind: "behavioral", en: "Give me an example of a decision you made based on data.", de: "Nennen Sie ein Beispiel für eine Entscheidung, die Sie auf Basis von Daten getroffen haben." },
  { id: "b4", competency: "stakeholder_management", kind: "behavioral", en: "Tell me about a cross-functional project. What was your role?", de: "Erzählen Sie von einem abteilungsübergreifenden Projekt. Was war Ihre Rolle?" },
  { id: "b5", competency: "leadership_ownership", kind: "behavioral", en: "Tell me about a mistake or failure and what you learned from it.", de: "Erzählen Sie von einem Fehler oder Misserfolg und was Sie daraus gelernt haben." },
  { id: "b6", competency: "problem_solving", kind: "behavioral", en: "How do you prioritise when everything is urgent? Give a real example.", de: "Wie priorisieren Sie, wenn alles dringend ist? Nennen Sie ein konkretes Beispiel." },
  { id: "b7", competency: "leadership_ownership", kind: "behavioral", en: "Describe a process you improved. What was the measurable result?", de: "Beschreiben Sie einen Prozess, den Sie verbessert haben. Was war das messbare Ergebnis?" },
  { id: "b8", competency: "communication", kind: "behavioral", en: "Tell me about a time you had to explain something complex to a non-expert.", de: "Erzählen Sie, wie Sie einmal etwas Komplexes einem Laien erklären mussten." },
  { id: "b9", competency: "stakeholder_management", kind: "behavioral", en: "Tell me about a time you had to push back on a manager or a customer.", de: "Erzählen Sie von einer Situation, in der Sie einem Vorgesetzten oder Kunden widersprechen mussten." },
  { id: "b10", competency: "leadership_ownership", kind: "behavioral", en: "Tell me about a time you took ownership of something outside your job description.", de: "Erzählen Sie, wann Sie Verantwortung für etwas außerhalb Ihrer Aufgaben übernommen haben." },
  { id: "d1", competency: "supply_chain_planning", kind: "domain", en: "How would you set the safety stock for a fast-moving item with unstable demand?", de: "Wie würden Sie den Sicherheitsbestand für einen Schnelldreher mit schwankender Nachfrage festlegen?" },
  { id: "d2", competency: "supply_chain_planning", kind: "domain", en: "Explain how you would measure and improve forecast accuracy.", de: "Wie würden Sie die Prognosegenauigkeit messen und verbessern?" },
  { id: "d3", competency: "supply_chain_planning", kind: "domain", en: "What is S&OP, and what makes it work or fail in practice?", de: "Was ist S&OP, und woran scheitert oder gelingt es in der Praxis?" },
  { id: "d4", competency: "supply_chain_planning", kind: "domain", en: "How would you use an ABC/XYZ analysis to manage inventory?", de: "Wie würden Sie eine ABC/XYZ-Analyse zur Bestandssteuerung nutzen?" },
  { id: "d5", competency: "procurement_supplier", kind: "domain", en: "How do you evaluate and select a new supplier?", de: "Wie bewerten und wählen Sie einen neuen Lieferanten aus?" },
  { id: "d6", competency: "procurement_supplier", kind: "domain", en: "How would you prepare for a price negotiation with a key supplier?", de: "Wie würden Sie sich auf eine Preisverhandlung mit einem wichtigen Lieferanten vorbereiten?" },
  { id: "d7", competency: "logistics_operations", kind: "domain", en: "Explain the difference between common Incoterms like EXW, FCA and DDP, and when you'd use them.", de: "Erklären Sie den Unterschied zwischen Incoterms wie EXW, FCA und DDP und wann Sie welche nutzen." },
  { id: "d8", competency: "analytical_data", kind: "domain", en: "Which KPIs would you track for a supply chain, and why? How is OTIF calculated?", de: "Welche KPIs würden Sie in einer Lieferkette verfolgen und warum? Wie berechnet man OTIF?" },
  { id: "d9", competency: "erp_tools", kind: "domain", en: "What have you done in SAP or another ERP? Walk me through a transaction or report you used.", de: "Was haben Sie in SAP oder einem anderen ERP gemacht? Beschreiben Sie eine Transaktion oder einen Bericht." },
  { id: "d10", competency: "analytical_data", kind: "domain", en: "How advanced is your Excel? Describe the most complex analysis you built.", de: "Wie gut sind Ihre Excel-Kenntnisse? Beschreiben Sie die komplexeste Analyse, die Sie gebaut haben." },
  { id: "d11", competency: "logistics_operations", kind: "domain", en: "How would you reduce transport costs without hurting service levels?", de: "Wie würden Sie Transportkosten senken, ohne den Servicegrad zu verschlechtern?" },
  { id: "d12", competency: "supply_chain_planning", kind: "domain", en: "What are the trade-offs between holding more inventory and running lean?", de: "Welche Zielkonflikte gibt es zwischen höheren Beständen und Lean?" },
  { id: "d13", competency: "procurement_supplier", kind: "domain", en: "How do you manage supplier risk and build resilience into a supply chain?", de: "Wie managen Sie Lieferantenrisiken und machen eine Lieferkette resilienter?" },
  { id: "c1", competency: "problem_solving", kind: "case", en: "A key supplier announces a three-week delay on a critical component. Walk me through your next 48 hours.", de: "Ein wichtiger Lieferant meldet drei Wochen Verzug bei einem kritischen Bauteil. Was tun Sie in den nächsten 48 Stunden?" },
  { id: "c2", competency: "supply_chain_planning", kind: "case", en: "Average daily demand is 200 units, standard deviation 40, lead time 9 days, target service level 95%. Roughly what safety stock and reorder point would you set?", de: "Tagesbedarf im Schnitt 200 Stück, Standardabweichung 40, Wiederbeschaffungszeit 9 Tage, Servicegrad 95 %. Welchen Sicherheitsbestand und Meldebestand würden Sie ungefähr ansetzen?" },
  { id: "c3", competency: "analytical_data", kind: "case", en: "Inventory went up 20% this quarter while sales were flat. How would you find out why?", de: "Der Bestand ist dieses Quartal um 20 % gestiegen, der Umsatz blieb gleich. Wie finden Sie die Ursache?" },
  { id: "c4", competency: "logistics_operations", kind: "case", en: "Our OTIF dropped from 95% to 82% in two months. How would you diagnose and fix it?", de: "Unser OTIF ist in zwei Monaten von 95 % auf 82 % gefallen. Wie analysieren und beheben Sie das?" },
  { id: "c5", competency: "procurement_supplier", kind: "case", en: "Two suppliers: one is 8% cheaper but has 85% on-time delivery, the other 97%. How do you decide?", de: "Zwei Lieferanten: einer ist 8 % günstiger, liefert aber nur zu 85 % pünktlich, der andere zu 97 %. Wie entscheiden Sie?" },
  { id: "c6", competency: "german_language", kind: "case", en: "A German supplier calls, upset about a late payment and threatening to stop deliveries. Handle the call with me now, in German.", de: "Ein Lieferant ruft verärgert wegen einer verspäteten Zahlung an und droht mit Lieferstopp. Führen Sie das Gespräch jetzt mit mir." },
  { id: "h1", competency: "hygiene", kind: "hygiene", en: "What is your current visa or work-permit situation? Do you need sponsorship?", de: "Wie ist Ihr aktueller Aufenthaltsstatus? Benötigen Sie eine Arbeitserlaubnis oder ein Visum?" },
  { id: "h2", competency: "hygiene", kind: "hygiene", en: "What are your salary expectations?", de: "Wie sind Ihre Gehaltsvorstellungen?" },
  { id: "h3", competency: "hygiene", kind: "hygiene", en: "When could you start, and do you have a notice period?", de: "Wann könnten Sie anfangen, und haben Sie eine Kündigungsfrist?" },
  { id: "h4", competency: "german_language", kind: "hygiene", en: "How good is your German? This role works with German colleagues and suppliers every day.", de: "Wie gut ist Ihr Deutsch? In dieser Rolle arbeiten Sie täglich mit deutschen Kollegen und Lieferanten." },
  { id: "h5", competency: "hygiene", kind: "hygiene", en: "Are you open to relocating or travelling for this role?", de: "Sind Sie bereit, für diese Stelle umzuziehen oder zu reisen?" },
  { id: "h6", competency: "motivation_fit", kind: "motivation", en: "What are your biggest strengths and one real weakness?", de: "Was sind Ihre größten Stärken und eine echte Schwäche?" },
  { id: "x1", competency: "closing_questions", kind: "closing", en: "Do you have any questions for us?", de: "Haben Sie noch Fragen an uns?" },
];
