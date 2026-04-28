const API_ERROR_MESSAGES = {
  en: {
    400: "The request could not be processed. Please check your input and try again.",
    401: "You are not logged in. Please sign in to continue.",
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
  },
  my: {
    400: "တောင်းဆိုချက်ကို လုပ်ဆောင်၍မရပါ။ သင့်အချက်အလက်များကို စစ်ဆေးပြီး ထပ်စမ်းကြည့်ပါ။",
    401: "သင် လော့ဂ်အင်မဝင်ရသေးပါ။ ဆက်လက်လုပ်ဆောင်ရန် လော့ဂ်အင်ဝင်ပါ။",
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
