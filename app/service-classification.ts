export type ServiceClassification = {
  service: string;
  skill: string;
  tool: string;
  priority: "Urgent" | "Standard";
  duration: number;
};

type ServiceM8JobText = Record<string, unknown>;

type IncomingRoutingJobText = {
  service?: unknown;
  issue?: unknown;
  requiredSkill?: unknown;
};

function searchableJobText(job: ServiceM8JobText) {
  return [
    job.job_description,
    job.work_done_description,
    job.description,
    job.category_name,
    job.queue_name,
    job.queue,
    job.status
  ].map(value => String(value || "")).join(" ");
}

export function classifyServiceM8Job(job: ServiceM8JobText): ServiceClassification {
  const text = searchableJobText(job);

  // Specific services must be checked before broader words such as "roof",
  // "gutter", "drain", "shower" or "leak".
  if (/shower\s*screen|frameless\s+(?:glass|screen)|semi[-\s]*frameless|bath\s*screen/i.test(text)) {
    return { service: "Shower screen", skill: "Shower Screens", tool: "", priority: "Standard", duration: 90 };
  }
  if (/(?:gutter|gutters).{0,30}(?:clean|cleaning|clear|clearing|blocked|leaves)|(?:clean|cleaning|clear|clearing).{0,30}(?:gutter|gutters)/i.test(text)) {
    return { service: "Gutter cleaning", skill: "Gutter Cleaning", tool: "Ladders", priority: "Standard", duration: 120 };
  }
  if (/pipe\s*relin(?:e|ed|ing)|relin(?:e|ed|ing).{0,24}(?:pipe|drain|sewer)|epoxy\s+(?:pipe\s+)?liner|sewer\s+liner/i.test(text)) {
    return { service: "Pipe relining", skill: "Pipe Relining", tool: "CCTV drain camera", priority: "Standard", duration: 240 };
  }
  if (/(?:drain|drainage|sewer|stormwater).{0,35}(?:replace|replacement|excavat|renew|renewal)|(?:replace|replacement|excavat|renew|renewal).{0,35}(?:drain|drainage|sewer|stormwater)/i.test(text)) {
    return { service: "Drainage replacement", skill: "Drainage Replacement", tool: "Drain locator", priority: "Standard", duration: 240 };
  }
  if (/(?:toilet|wc).{0,24}(?:replace|replacement|install|installation|new\s+suite)|(?:replace|replacement|install|installation).{0,24}(?:toilet|wc)/i.test(text)) {
    return { service: "Toilet replacement", skill: "Toilet Replacement", tool: "", priority: "Standard", duration: 90 };
  }
  if (/(?:vanity|basin\s+cabinet).{0,24}(?:replace|replacement|install|installation)|(?:replace|replacement|install|installation).{0,24}(?:vanity|basin\s+cabinet)/i.test(text)) {
    return { service: "Vanity replacement", skill: "Vanity Replacement", tool: "", priority: "Standard", duration: 150 };
  }
  if (/(?:bathroom|kitchen|laundry).{0,35}(?:renovation|renovate|remodel|rough[-\s]*in)|(?:renovation|renovate|remodel|rough[-\s]*in).{0,35}(?:bathroom|kitchen|laundry)/i.test(text)) {
    return { service: "Bathroom renovation plumbing", skill: "Bathroom Renovation Plumbing", tool: "", priority: "Standard", duration: 180 };
  }

  // Same-day emergency rules are kept unchanged, with hot-water installation
  // separated from hot-water repair so the configured skills are meaningful.
  if (/(?:blocked|blockage|block).{0,28}(?:drain|toilet)|(?:drain|toilet).{0,28}(?:blocked|blockage)/i.test(text)) {
    return { service: "Blocked drain or toilet", skill: "Blocked Drains", tool: "High-pressure jetter", priority: "Urgent", duration: 90 };
  }
  if (/(?:hws|hot\s*water|water\s*heater|thermann|rheem|dux).{0,45}(?:replace|replacement|install|installation|upgrade)|(?:replace|replacement|install|installation|upgrade).{0,45}(?:hws|hot\s*water|water\s*heater|thermann|rheem|dux)/i.test(text)) {
    return { service: "Hot water installation or replacement", skill: "Hot Water Installation", tool: "Hot water tools", priority: "Urgent", duration: 90 };
  }
  if (/(?:hws|hot\s*water|water\s*heater|thermann|rheem|dux).{0,45}(?:leak|leaking|burst|repair|not\s*working|no\s*hot\s*water|fault|service)|(?:leak|leaking|burst|repair|not\s*working|fault|service).{0,45}(?:hws|hot\s*water|water\s*heater|thermann|rheem|dux)/i.test(text)) {
    return { service: "Hot water repair", skill: "Hot Water", tool: "Hot water tools", priority: "Urgent", duration: 90 };
  }
  if (/burst.{0,24}(?:pipe|water|line)|(?:pipe|water|line).{0,24}burst|flood(?:ed|ing)?|water\s+(?:everywhere|pouring|gushing|running)|overflow(?:ing)?/i.test(text)) {
    return { service: "Burst pipe or active flooding", skill: "General Plumbing", tool: "", priority: "Urgent", duration: 90 };
  }
  if (/gas.{0,24}leak|leak.{0,24}gas/i.test(text)) {
    return { service: "Gas leak", skill: "Gas", tool: "Gas testing equipment", priority: "Urgent", duration: 90 };
  }

  if (/\broof(?:s|ing)?\b|flashing|ridge\s*capp?ing|whirlybird/i.test(text)) {
    return { service: "Roofing", skill: "Roofing", tool: "Roofing equipment", priority: "Standard", duration: 120 };
  }
  if (/gutter|down\s*pipe|downpipe|fascia|rainhead|box\s*gutter/i.test(text)) {
    return { service: "Guttering", skill: "Guttering", tool: "Ladders", priority: "Standard", duration: 120 };
  }
  if (/regrout|re-grout|grout\s+(?:repair|replacement)|epoxy\s+grout/i.test(text)) {
    return { service: "Regrouting", skill: "Regrouting", tool: "", priority: "Standard", duration: 180 };
  }
  if (/waterproof|water\s*proof|membrane|tanking/i.test(text)) {
    return { service: "Waterproofing", skill: "Waterproofing", tool: "", priority: "Standard", duration: 240 };
  }
  if (/leak\s*detection|locate.{0,20}leak|concealed\s+leak|pressure\s+test|dye\s+test|shower.{0,24}leak|leak.{0,24}shower/i.test(text)) {
    return { service: "Leak detection", skill: "Leak Detection", tool: "Leak detection equipment", priority: "Standard", duration: 120 };
  }
  if (/electric|power\s*point|switchboard|circuit|light(?:ing)?|ceiling\s*fan|smoke\s*alarm/i.test(text)) {
    return { service: "Electrical", skill: "Electrical", tool: "Electrical testing equipment", priority: "Standard", duration: 90 };
  }
  if (/\bgas\b|gas\s*heater|cooktop|bayonet/i.test(text)) {
    return { service: "Gas service", skill: "Gas", tool: "Gas testing equipment", priority: "Standard", duration: 90 };
  }
  if (/\bhws\b|hot\s*water|water\s*heater|thermann|rheem|dux/i.test(text)) {
    return { service: "Hot water service", skill: "Hot Water", tool: "Hot water tools", priority: "Standard", duration: 90 };
  }

  return { service: "General enquiry", skill: "General Plumbing", tool: "", priority: "Standard", duration: 60 };
}

// Same Day AI can hand Auto Route a focused job before that job appears in the
// live ServiceM8 schedule feed. Those handoffs sometimes contain the generic
// General Plumbing fallback even when the job description names a specialist
// service. Only repair generic/missing classifications here: a specific skill
// selected upstream must remain authoritative.
export function specialistClassificationFallback(job: IncomingRoutingJobText): ServiceClassification | null {
  const currentSkill = String(job.requiredSkill || "").trim();
  if (currentSkill && currentSkill !== "General Plumbing") return null;

  const classification = classifyServiceM8Job({
    job_description: job.issue,
    description: job.service
  });
  return classification.skill === "General Plumbing" ? null : classification;
}
