import {
  WEEKDAYS_AR,
  WEEKDAYS_EN,
  formatLong,
  resolveWeekday,
} from "../dates";
import type { ProposalPayload } from "../types";

/**
 * Offline assistant: deterministic rule-based extractor used when no AI key is
 * configured. Labelled "Offline draft" in the UI — never presented as a model.
 * Handles English + Egyptian Arabic + mixed input. Never invents prices/dates.
 */

interface Ctx {
  todayISO: string;
  todayWeekday: number;
  timezone: string;
  defaultCurrency: string;
}

const CURRENCY_TOKENS: [RegExp, string][] = [
  [/\bEGP\b|ج\s*\.?\s*م|جنيه|جنى/i, "EGP"],
  [/\bUSD\b|\$\s*\d|دولار/i, "USD"],
  [/\bEUR\b|€|يورو/i, "EUR"],
  [/\bSAR\b|ريال\s*سعود|﷼/i, "SAR"],
  [/\bAED\b|درهم/i, "AED"],
];

function detectCurrency(text: string): string | null {
  for (const [re, code] of CURRENCY_TOKENS) if (re.test(text)) return code;
  return null;
}

function detectMoney(text: string): { amount: number | null; currency: string | null } {
  const normalized = text
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/(\d),(?=\d{3}(?:\D|$))/g, "$1");
  const number = "(\\d+(?:\\.\\d+)?)";
  const currency = "(?:EGP|USD|EUR|SAR|AED|جنيه|جنى|ج\\.?\\s*م|دولار|ريال|درهم|\\$|€)";
  // Require a nearby money token or a direct budget/price label. Counts and
  // calendar dates elsewhere in the request are never treated as prices.
  const adjacent = normalized.match(new RegExp(`${number}\\s*${currency}(?![a-z])`, "i"))
    ?? normalized.match(new RegExp(`${currency}\\s*${number}`, "i"));
  const labeled = normalized.match(new RegExp(`(?:budget|price|ميزانية|الميزانية|مبلغ|سعر|تكلفة)\\s*(?:(?:is|of|about|around)\\s*)?[:=~]?\\s*${number}`, "i"));
  const match = adjacent ?? labeled;
  const amount = match ? Number(match[1]) : null;
  return { amount: amount !== null && Number.isFinite(amount) ? amount : null, currency: match ? detectCurrency(match[0]) : null };
}

function detectLanguage(text: string): "en" | "ar" | "mixed" {
  const ar = /[\u0600-\u06FF]/.test(text);
  const en = /[a-zA-Z]/.test(text);
  if (ar && en) return "mixed";
  return ar ? "ar" : "en";
}

function detectDeadline(text: string, ctx: Ctx): ProposalPayload["deadline"] {
  const lower = text.toLowerCase();
  // weekday match (EN)
  for (let i = 0; i < 7; i++) {
    const day = WEEKDAYS_EN[i];
    const reNext = new RegExp(`next\\s+${day}\\b`);
    const reThis = new RegExp(`(?:this\\s+)?${day}\\b`);
    if (reNext.test(lower)) {
      const iso = resolveWeekday(i, "next", ctx.todayISO, ctx.todayWeekday);
      return {
        dateISO: iso,
        textOriginal: `next ${day}`,
        ambiguous: true,
        interpretation: formatLong(iso, ctx.timezone),
      };
    }
    if (reThis.test(lower)) {
      const iso = resolveWeekday(i, "none", ctx.todayISO, ctx.todayWeekday);
      return {
        dateISO: iso,
        textOriginal: day,
        ambiguous: day === "friday" ? true : false,
        interpretation: formatLong(iso, ctx.timezone),
      };
    }
  }
  // weekday match (AR): الجمعة الجاية / يوم الجمعة ...
  for (const [name, wd] of Object.entries(WEEKDAYS_AR)) {
    if (text.includes(name)) {
      const isNext = /الجاي[ةه]?|اللي\s*جاي/.test(text);
      const iso = resolveWeekday(wd, isNext ? "next" : "none", ctx.todayISO, ctx.todayWeekday);
      return {
        dateISO: iso,
        textOriginal: name,
        ambiguous: isNext,
        interpretation: formatLong(iso, ctx.timezone),
      };
    }
  }
  // explicit YYYY-MM-DD or D/M
  const m = text.match(/(\d{4})-(\d{2})-(\d{2})/) ?? text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
  if (m) {
    const iso = m[3] && m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : null;
    if (iso) return { dateISO: iso, textOriginal: m[0], ambiguous: false, interpretation: formatLong(iso, ctx.timezone) };
  }
  return { dateISO: null, textOriginal: null, ambiguous: false, interpretation: null };
}

function detectClient(text: string): string | null {
  const patterns = [
    /\b([A-Z][a-z]+)\s+wants\b/,
    /\bfor\s+([A-Z][a-z]+)(?:'s)?\s+(?:gym|store|shop|company|restaurant|clinic)/,
    /(?:عميل|العميل|أستاذ|استاذ)\s+([\u0600-\u06FF]+(?:\s+[\u0600-\u06FF]+)?)/,
    /\b([A-Z][a-z]+)\s+(?:asked|requested|needs|need)\b/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

function detectKind(text: string): { title: string; deliverables: string[]; tasks: ProposalPayload["tasks"] } {
  const lower = text.toLowerCase();
  const hasAR = /[\u0600-\u06FF]/.test(text);
  const wants = (en: RegExp, ar?: RegExp) => en.test(lower) || (ar ? ar.test(text) : false);
  if (wants(/landing page/, /لاندنج|صفحة\s*هبوط|لاندينج/)) {
    return {
      title: hasAR && !/[a-zA-Z]/.test(text) ? "صفحة هبوط جديدة" : "New landing page",
      deliverables: ["Landing page"],
      tasks: [
        { title: "Confirm page sections and copy source", isClientRequirement: false },
        { title: "Design landing page", isClientRequirement: true },
        { title: "Build + responsive check", isClientRequirement: true },
        { title: "Review round and delivery", isClientRequirement: false },
      ],
    };
  }
  if (wants(/logo/, /لوجو|شعار/)) {
    return {
      title: hasAR && !/[a-zA-Z]/.test(text) ? "تصميم لوجو" : "Logo design",
      deliverables: ["Logo"],
      tasks: [
        { title: "Collect brand references", isClientRequirement: false },
        { title: "Draft logo concepts", isClientRequirement: true },
        { title: "Finalize + export files", isClientRequirement: true },
      ],
    };
  }
  if (wants(/website|web site|متجر|موقع/, /موقع/)) {
    return {
      title: "New website",
      deliverables: ["Website"],
      tasks: [
        { title: "Confirm sitemap and pages", isClientRequirement: false },
        { title: "Design pages", isClientRequirement: true },
        { title: "Develop website", isClientRequirement: true },
        { title: "Launch + handover", isClientRequirement: false },
      ],
    };
  }
  return {
    title: "New client request",
    deliverables: [],
    tasks: [{ title: "Clarify scope and deliverables", isClientRequirement: false }],
  };
}

export function extractOffline(message: string, ctx: Ctx): ProposalPayload {
  const language = detectLanguage(message);
  const kind = detectKind(message);
  const clientName = detectClient(message);
  const deadline = detectDeadline(message, ctx);
  const { amount, currency } = detectMoney(message);

  const missingEssential: ProposalPayload["missingEssential"] = [];
  if (kind.deliverables.length === 0) {
    missingEssential.push({
      field: "deliverables",
      question: language === "ar" ? "إيه المطلوب تنفيذه بالضبط؟" : "What exactly should be delivered?",
    });
  } else if (/landing page/i.test(message) || /لاندنج|هبوط|لاندينج/.test(message)) {
    if (!/(section|صفحة|سクション|أقسام|اقسام|content|محتوى)/i.test(message)) {
      missingEssential.push({
        field: "scope",
        question: language === "ar"
          ? "صفحة الهبوط هتتكون من أقسام إيه، والمحتوى هييجي منين؟"
          : "Which sections should the landing page include, and who provides the content?",
      });
    }
  }
  if (!deadline.dateISO) {
    missingEssential.push({
      field: "deadline",
      question: language === "ar" ? "الموعد النهائي للتسليم إمتى؟" : "When is the delivery deadline?",
    });
  } else if (deadline.ambiguous) {
    missingEssential.push({
      field: "deadline",
      question: language === "ar"
        ? `تقصد يوم إيه بالضبط؟ أنا فهمت: ${deadline.interpretation}.`
        : `Which day exactly? I read it as: ${deadline.interpretation}.`,
    });
  }

  const assumptions: ProposalPayload["assumptions"] = [];
  if (deadline.ambiguous && deadline.interpretation) {
    assumptions.push({ text: `Deadline read as ${deadline.interpretation}`, needsConfirmation: true });
  }

  return {
    title: clientName ? `${kind.title} — ${clientName}` : kind.title,
    summary: message.length > 220 ? message.slice(0, 220) + "…" : message,
    clientName,
    deliverables: kind.deliverables,
    requirements: kind.deliverables.map((d) => ({ text: d, source: "explicit" as const })),
    deadline,
    budget: { amount, currency: amount != null ? currency : null, unknown: amount == null },
    tasks: kind.tasks,
    missingEssential: missingEssential.slice(0, 3),
    optionalUnknowns: amount == null ? ["Budget: Unknown / decide later"] : [],
    assumptions,
    language,
  };
}
