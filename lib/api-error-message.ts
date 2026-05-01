const API_ERROR_MESSAGES = {
  en: {
    400: "The request could not be processed. Please check your input and try again.",
    401: "You are not logged in. Please sign in to continue.",
    402: "Insufficient Points.",
    403: "You do not have permission to perform this action.",
    404: "The requested resource could not be found.",
    408: "The request took too long. Please try again.",
    409: "This action conflicts with existing data. Please refresh and try again.",
    413: "The file or data you submitted is too large.",
    422: "The submitted data is invalid. Please review and correct it.",
    429: "Too many requests. Please wait a moment and try again.",
    500: "Something went wrong on our end. Please try again later.",
    502: "We are experiencing server issues. Please try again shortly.",
    503: "The service is temporarily unavailable. Please try again later.",
    504: "The server took too long to respond. Please try again.",
    network: "Unable to connect. Please check your internet connection.",
    default: "An unexpected error occurred. Please try again.",
    userPointsNotFound: "You do not have any points yet.",
    insufficientPointsDetail:
      "You have {available} points available; {required} points are required for this action.",
  },
  my: {
    400: "တောင်းဆိုချက်ကို လုပ်ဆောင်၍မရပါ။ သင့်အချက်အလက်များကို စစ်ဆေးပြီး ထပ်စမ်းကြည့်ပါ။",
    401: "သင် လော့ဂ်အင်မဝင်ရသေးပါ။ ဆက်လက်လုပ်ဆောင်ရန် လော့ဂ်အင်ဝင်ပါ။",
    402: "ပွိုင့်မလုံလောက်ပါ",
    403: "ဤလုပ်ဆောင်ချက်ကို ပြုလုပ်ခွင့် သင့်တွင်မရှိပါ။",
    404: "တောင်းဆိုထားသော အရင်းအမြစ်ကို ရှာမတွေ့ပါ။",
    408: "တောင်းဆိုချက် အချိန်များသွားပါပြီ။ ထပ်စမ်းကြည့်ပါ။",
    409: "ဤလုပ်ဆောင်ချက်သည် ရှိပြီးသား ဒေတာနှင့် ပဋိပက္ခဖြစ်နေသည်။ စာမျက်နှာကို ပြန်လည်လည်ပတ်ပြီး ထပ်စမ်းပါ။",
    413: "သင်တင်သွင်းသော ဖိုင် သို့မဟုတ် ဒေတာသည် အရွယ်အစားကြီးလွန်းသည်။",
    422: "တင်သွင်းသော ဒေတာသည် မမှန်ကန်ပါ။ ပြန်လည်စစ်ဆေးပြီး ပြင်ဆင်ပါ။",
    429: "တောင်းဆိုချက် အများဆုံးပြုလုပ်မှု ကျော်လွန်သွားပါပြီ။ ခဏစောင့်ပြီး ထပ်စမ်းကြည့်ပါ။",
    500: "ကျွန်ုပ်တို့ဘက်တွင် အမှားတစ်ခု ဖြစ်ပွားသွားသည်။ နောက်မှ ထပ်စမ်းကြည့်ပါ။",
    502: "ချိတ်ဆက်မှု ပြဿနာများ ကြုံတွေ့နေရသည်။ ခဏနောက်မှ ထပ်စမ်းကြည့်ပါ။",
    503: "ဝန်ဆောင်မှုသည် ယာယီမရရှိနိုင်ပါ။ နောက်မှ ထပ်စမ်းကြည့်ပါ။",
    504: "ဆာဗာမှ တုံ့ပြန်ရန် အချိန်များသွားသည်။ ထပ်စမ်းကြည့်ပါ။",
    network: "ချိတ်ဆက်၍မရပါ။ သင့်အင်တာနက် ချိတ်ဆက်မှုကို စစ်ဆေးပါ။",
    default: "မမျှော်လင့်သော အမှားတစ်ခု ဖြစ်ပွားသွားသည်။ ထပ်စမ်းကြည့်ပါ။",
    userPointsNotFound: "ပွိုင့် မရှိသေးပါ",
    insufficientPointsDetail:
      "သင့်တွင် {available} ပွိုင့် ရှိပြီး၊ ဤလုပ်ဆောင်ချက်အတွက် {required} ပွိုင့် လိုအပ်ပါသည်။",
  },
} as const;

type AppErrorLocale = "en" | "my";

export function resolveErrorLocale(input?: string): AppErrorLocale {
  const locale = (input ?? "").toLowerCase();
  return locale === "my" || locale === "mm" ? "my" : "en";
}

export function detectCurrentLocale(): AppErrorLocale {
  if (typeof document === "undefined") return "en";
  const lang = document.documentElement?.lang ?? "";
  return resolveErrorLocale(lang);
}

/** True when the API returned a 404-style "no UserPoints row" error (balance not initialized). */
export function isUserPointsNotFoundErrorBody(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const msg = (body as Record<string, unknown>).message;
  if (typeof msg !== "string") return false;
  const lower = msg.toLowerCase();
  return lower.includes("userpoints") && lower.includes("not found");
}

function coerceFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Parses insufficient-points payloads: envelope `data` or text like `available=17, required=230`. */
function parseInsufficientPointsFromBody(body: unknown): { available: number; required: number } | null {
  if (!body || typeof body !== "object") return null;
  const rec = body as Record<string, unknown>;
  const data = rec.data;
  if (data != null && typeof data === "object") {
    const d = data as Record<string, unknown>;
    const available = coerceFiniteNumber(d.available ?? d.availablePoints);
    const required = coerceFiniteNumber(d.required ?? d.requiredPoints);
    if (available !== null && required !== null) return { available, required };
  }
  const msg = rec.message;
  if (typeof msg !== "string") return null;
  const m1 = msg.match(/available\s*=\s*(\d+)\s*,\s*required\s*=\s*(\d+)/i);
  if (m1) return { available: Number(m1[1]), required: Number(m1[2]) };
  const m2 = msg.match(/required\s*=\s*(\d+)\s*,\s*available\s*=\s*(\d+)/i);
  if (m2) return { available: Number(m2[2]), required: Number(m2[1]) };
  return null;
}

function formatInsufficientPointsMessage(
  localeKey: AppErrorLocale,
  available: number,
  required: number,
): string {
  const tpl = API_ERROR_MESSAGES[localeKey].insufficientPointsDetail;
  return tpl.replace("{available}", String(available)).replace("{required}", String(required));
}

export function resolveHttpErrorMessage(status: number, body: unknown, locale?: string): string {
  const key = locale === undefined ? detectCurrentLocale() : resolveErrorLocale(locale);
  if (status === 404 && isUserPointsNotFoundErrorBody(body)) {
    return API_ERROR_MESSAGES[key].userPointsNotFound;
  }
  if (status === 402) {
    const parsed = parseInsufficientPointsFromBody(body);
    if (parsed) return formatInsufficientPointsMessage(key, parsed.available, parsed.required);
    if (body && typeof body === "object") {
      const msg = (body as Record<string, unknown>).message;
      if (typeof msg === "string" && msg.trim()) return msg.trim();
    }
    return getStatusErrorMessage(status, key);
  }
  return getStatusErrorMessage(status, key);
}

const DEFAULT_CLIENT_ERROR_MAX_LEN = 320;

export type NormalizeClientErrorOptions = {
  /** When set, overrides {@link detectCurrentLocale} (e.g. pass-through from next-intl). */
  locale?: string;
  /** Truncate uncategorized messages; omit for {@link DEFAULT_CLIENT_ERROR_MAX_LEN}. */
  maxLength?: number;
};

/**
 * Normalizes plain error strings from SSE, catches, etc. so insufficient-points / 402-style API text
 * matches {@link resolveHttpErrorMessage} formatting across pages.
 */
export function normalizeClientErrorMessage(
  raw: string,
  opt?: NormalizeClientErrorOptions,
): string {
  const localeKey = opt?.locale === undefined ? detectCurrentLocale() : resolveErrorLocale(opt.locale);
  const msg = (raw ?? "").trim();
  if (!msg) return getDefaultErrorMessage(localeKey);

  const fromCounts = parseInsufficientPointsFromBody({ message: msg });
  if (fromCounts) {
    return formatInsufficientPointsMessage(localeKey, fromCounts.available, fromCounts.required);
  }

  const lower = msg.toLowerCase();
  if (lower.includes("insufficient points") || lower.includes("insufficient point")) {
    return resolveHttpErrorMessage(402, { message: msg }, localeKey);
  }

  const parenMatch = msg.match(/\((\d{3})\)/);
  if (parenMatch) {
    const st = Number(parenMatch[1]);
    if (Number.isFinite(st)) {
      return resolveHttpErrorMessage(st, { message: msg }, localeKey);
    }
  }

  const leadingStatus = msg.match(/^(\d{3})\b/);
  if (leadingStatus) {
    const st = Number(leadingStatus[1]);
    if (Number.isFinite(st) && st >= 400 && st <= 599) {
      return resolveHttpErrorMessage(st, { message: msg }, localeKey);
    }
  }

  if (lower.includes("network") || lower.includes("failed to fetch")) {
    return getNetworkErrorMessage(localeKey);
  }

  const maxLen = opt?.maxLength ?? DEFAULT_CLIENT_ERROR_MAX_LEN;
  if (msg.length > maxLen) return `${msg.slice(0, maxLen)}…`;
  return msg;
}

export function getStatusErrorMessage(status: number, locale?: string): string {
  const key = resolveErrorLocale(locale);
  const dict = API_ERROR_MESSAGES[key] as Record<string, string>;
  return dict[String(status)] ?? dict.default;
}

export function getNetworkErrorMessage(locale?: string): string {
  return API_ERROR_MESSAGES[resolveErrorLocale(locale)].network;
}

export function getDefaultErrorMessage(locale?: string): string {
  return API_ERROR_MESSAGES[resolveErrorLocale(locale)].default;
}

export function getUserPointsNotFoundMessage(locale?: string): string {
  const key = locale === undefined ? detectCurrentLocale() : resolveErrorLocale(locale);
  return API_ERROR_MESSAGES[key].userPointsNotFound;
}
