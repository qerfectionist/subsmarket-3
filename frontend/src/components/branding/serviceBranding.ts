export type ServiceCategory =
  | "video_streaming"
  | "music_audio"
  | "education_books"
  | "cloud_productivity"
  | "security_utilities"
  | "mobile_tariffs"
  | "default";

export type ServiceBrand = {
  color: string;
  iconSlug: string | null;
  logoPath?: string;
  category: ServiceCategory;
  monogram: string;
  monochrome?: boolean;
};

const BRAND_BY_SLUG: Record<string, ServiceBrand> = {
  // Video streaming
  "netflix-premium": { color: "#E50914", iconSlug: "netflix", logoPath: "/brand-assets/netflix.svg", category: "video_streaming", monogram: "N" },
  netflix: { color: "#E50914", iconSlug: "netflix", logoPath: "/brand-assets/netflix.svg", category: "video_streaming", monogram: "N" },
  "youtube-premium": { color: "#FF0000", iconSlug: "youtube", logoPath: "/brand-assets/youtube.svg", category: "video_streaming", monogram: "YT" },
  youtube: { color: "#FF0000", iconSlug: "youtube", logoPath: "/brand-assets/youtube.svg", category: "video_streaming", monogram: "YT" },
  "hbo-max": { color: "#5B2D82", iconSlug: "hbomax", category: "video_streaming", monogram: "H" },
  "yandex-plus": { color: "#FC3F1D", iconSlug: "yandex", logoPath: "/brand-assets/yandex.svg", category: "video_streaming", monogram: "Я" },
  yandex: { color: "#FC3F1D", iconSlug: "yandex", logoPath: "/brand-assets/yandex.svg", category: "video_streaming", monogram: "Я" },
  ivi: { color: "#FF3B30", iconSlug: null, category: "video_streaming", monogram: "IV" },
  megogo: { color: "#00A0E3", iconSlug: null, category: "video_streaming", monogram: "M" },
  qino: { color: "#6C5CE7", iconSlug: null, category: "video_streaming", monogram: "Q" },
  okko: { color: "#111111", iconSlug: null, category: "video_streaming", monogram: "O" },
  amediateka: { color: "#E31E24", iconSlug: null, category: "video_streaming", monogram: "A" },
  "prime-video": { color: "#00A8E1", iconSlug: "prime", category: "video_streaming", monogram: "P" },
  "disney-plus": { color: "#113CCF", iconSlug: "disneyplus", category: "video_streaming", monogram: "D+" },
  crunchyroll: { color: "#F47521", iconSlug: "crunchyroll", category: "video_streaming", monogram: "CR" },
  "ilook-tv": { color: "#2563EB", iconSlug: null, category: "video_streaming", monogram: "iL" },

  // Music & audio
  "spotify-family": { color: "#1DB954", iconSlug: "spotify", logoPath: "/brand-assets/spotify.svg", category: "music_audio", monogram: "S" },
  spotify: { color: "#1DB954", iconSlug: "spotify", logoPath: "/brand-assets/spotify.svg", category: "music_audio", monogram: "S" },
  "apple-music": { color: "#FA243C", iconSlug: "applemusic", logoPath: "/brand-assets/applemusic.svg", category: "music_audio", monogram: "♫" },

  // Education
  "duolingo-super": {
    color: "#58CC02",
    iconSlug: "duolingo",
    logoPath: "/brand-assets/duolingo.png",
    category: "education_books",
    monogram: "D"
  },
  "duolingo-max": {
    color: "#58CC02",
    iconSlug: "duolingo",
    logoPath: "/brand-assets/duolingo.png",
    category: "education_books",
    monogram: "D"
  },
  duolingo: {
    color: "#58CC02",
    iconSlug: "duolingo",
    logoPath: "/brand-assets/duolingo.png",
    category: "education_books",
    monogram: "D"
  },
  "mybook-premium": { color: "#7C3AED", iconSlug: null, category: "education_books", monogram: "MB" },

  // Productivity & Cloud
  "microsoft-365-family": {
    color: "#00A4EF",
    iconSlug: null,
    logoPath: "/microsoft-365.svg",
    category: "cloud_productivity",
    monogram: "365"
  },
  "microsoft-365": {
    color: "#00A4EF",
    iconSlug: null,
    logoPath: "/microsoft-365.svg",
    category: "cloud_productivity",
    monogram: "365"
  },
  "apple-one": { color: "#111111", iconSlug: "apple", logoPath: "/brand-assets/apple.svg", category: "cloud_productivity", monogram: "", monochrome: true },
  apple: { color: "#111111", iconSlug: "apple", logoPath: "/brand-assets/apple.svg", category: "cloud_productivity", monogram: "", monochrome: true },
  "icloud-plus-2tb": { color: "#3693F3", iconSlug: "icloud", category: "cloud_productivity", monogram: "iC" },
  "google-one": {
    color: "#4285F4",
    iconSlug: "google",
    logoPath: "/google-g.svg",
    category: "cloud_productivity",
    monogram: "G"
  },
  google: {
    color: "#4285F4",
    iconSlug: "google",
    logoPath: "/google-g.svg",
    category: "cloud_productivity",
    monogram: "G"
  },
  chatgpt: {
    color: "#10A37F",
    iconSlug: null,
    logoPath: "/brand-assets/openai.svg",
    category: "cloud_productivity",
    monogram: "AI",
    monochrome: true
  },
  openai: {
    color: "#10A37F",
    iconSlug: null,
    logoPath: "/brand-assets/openai.svg",
    category: "cloud_productivity",
    monogram: "AI",
    monochrome: true
  },
  canva: {
    color: "#00C4CC",
    iconSlug: null,
    logoPath: "/brand-assets/canva.svg",
    category: "cloud_productivity",
    monogram: "C"
  },
  gemini: {
    color: "#4E82EE",
    iconSlug: null,
    logoPath: "/brand-assets/gemini.svg",
    category: "cloud_productivity",
    monogram: "G"
  },
  grok: {
    color: "#000000",
    iconSlug: null,
    logoPath: "/brand-assets/grok.svg",
    category: "cloud_productivity",
    monogram: "X",
    monochrome: true
  },

  // Security
  "kaspersky-standard": { color: "#006D5C", iconSlug: "kaspersky", category: "security_utilities", monogram: "K" },
  "kaspersky-vpn": { color: "#006D5C", iconSlug: "kaspersky", category: "security_utilities", monogram: "K" },
  "adguard-vpn": { color: "#68BC71", iconSlug: "adguard", category: "security_utilities", monogram: "AG" },
  awax: { color: "#4F46E5", iconSlug: null, category: "security_utilities", monogram: "A" },

  // Mobile Tariffs & Operators (Official Brand Assets)
  "altel-family-tariff": {
    color: "#EC008C",
    iconSlug: null,
    logoPath: "/brand-assets/altel.svg",
    category: "mobile_tariffs",
    monogram: "A"
  },
  altel: {
    color: "#EC008C",
    iconSlug: null,
    logoPath: "/brand-assets/altel.svg",
    category: "mobile_tariffs",
    monogram: "A"
  },
  "beeline-family-tariff": {
    color: "#FFD400",
    iconSlug: null,
    logoPath: "/brand-assets/beeline.svg",
    category: "mobile_tariffs",
    monogram: "B"
  },
  beeline: {
    color: "#FFD400",
    iconSlug: null,
    logoPath: "/brand-assets/beeline.svg",
    category: "mobile_tariffs",
    monogram: "B"
  },
  "tele2-family-tariff": {
    color: "#FFFFFF",
    iconSlug: null,
    logoPath: "/brand-assets/tele2.svg",
    category: "mobile_tariffs",
    monogram: "T2",
    monochrome: true
  },
  tele2: {
    color: "#FFFFFF",
    iconSlug: null,
    logoPath: "/brand-assets/tele2.svg",
    category: "mobile_tariffs",
    monogram: "T2",
    monochrome: true
  },
  "kcell-family-tariff": {
    color: "#6B21A8",
    iconSlug: null,
    logoPath: "/brand-assets/kcell.png",
    category: "mobile_tariffs",
    monogram: "K"
  },
  kcell: {
    color: "#6B21A8",
    iconSlug: null,
    logoPath: "/brand-assets/kcell.png",
    category: "mobile_tariffs",
    monogram: "K"
  },
  "activ-family-tariff": {
    color: "#E11D48",
    iconSlug: null,
    logoPath: "/brand-assets/activ.png",
    category: "mobile_tariffs",
    monogram: "ac"
  },
  activ: {
    color: "#E11D48",
    iconSlug: null,
    logoPath: "/brand-assets/activ.png",
    category: "mobile_tariffs",
    monogram: "ac"
  },
  "izi-family-tariff": {
    color: "#00E5FF",
    iconSlug: null,
    logoPath: "/brand-assets/izi.png",
    category: "mobile_tariffs",
    monogram: "izi"
  },
  izi: {
    color: "#00E5FF",
    iconSlug: null,
    logoPath: "/brand-assets/izi.png",
    category: "mobile_tariffs",
    monogram: "izi"
  }
};

const NAME_TO_SLUG: Record<string, string> = {
  Canva: "canva",
  canva: "canva",
  Gemini: "gemini",
  gemini: "gemini",
  Grok: "grok",
  grok: "grok",
  Netflix: "netflix-premium",
  netflix: "netflix-premium",
  "YouTube Premium": "youtube-premium",
  YouTube: "youtube-premium",
  youtube: "youtube-premium",
  "HBO Max": "hbo-max",
  "Яндекс Плюс": "yandex-plus",
  "Яндекс": "yandex-plus",
  Yandex: "yandex-plus",
  yandex: "yandex-plus",
  Иви: "ivi",
  Megogo: "megogo",
  Qino: "qino",
  Okko: "okko",
  Амедиатека: "amediateka",
  "Prime Video": "prime-video",
  "Disney+": "disney-plus",
  Crunchyroll: "crunchyroll",
  iLookTV: "ilook-tv",
  Spotify: "spotify-family",
  spotify: "spotify-family",
  "Apple Music": "apple-music",
  Duolingo: "duolingo-super",
  duolingo: "duolingo-super",
  MyBook: "mybook-premium",
  "Microsoft 365": "microsoft-365-family",
  "Apple One": "apple-one",
  "iCloud+": "icloud-plus-2tb",
  "Google One": "google-one",
  Google: "google-one",
  ChatGPT: "chatgpt",
  chatgpt: "chatgpt",
  Kaspersky: "kaspersky-standard",
  "Kaspersky VPN": "kaspersky-vpn",
  "AdGuard VPN": "adguard-vpn",
  Awax: "awax",
  Beeline: "beeline-family-tariff",
  beeline: "beeline-family-tariff",
  Tele2: "tele2-family-tariff",
  tele2: "tele2-family-tariff",
  Altel: "altel-family-tariff",
  altel: "altel-family-tariff",
  Kcell: "kcell-family-tariff",
  kcell: "kcell-family-tariff",
  activ: "activ-family-tariff",
  Activ: "activ-family-tariff",
  izi: "izi-family-tariff",
  Izi: "izi-family-tariff",
  IZI: "izi-family-tariff"
};

const DEFAULT_BRAND: ServiceBrand = {
  color: "#2481cc",
  iconSlug: null,
  category: "default",
  monogram: "S"
};

export function resolveServiceBrand(input: {
  serviceSlug?: string | null;
  serviceName?: string | null;
  familyType?: "subscription" | "tariff";
}) {
  const rawSlug = input.serviceSlug?.trim().toLowerCase();
  if (rawSlug) {
    if (BRAND_BY_SLUG[rawSlug]) {
      return BRAND_BY_SLUG[rawSlug];
    }
    const cleanSlug = rawSlug.replace(/-family-tariff$/, "").replace(/-(premium|plus|super|max|family)$/, "");
    if (BRAND_BY_SLUG[cleanSlug]) {
      return BRAND_BY_SLUG[cleanSlug];
    }
    const tariffSlug = `${cleanSlug}-family-tariff`;
    if (BRAND_BY_SLUG[tariffSlug]) {
      return BRAND_BY_SLUG[tariffSlug];
    }
  }

  const name = input.serviceName?.trim();
  if (name) {
    const slug = NAME_TO_SLUG[name] ?? NAME_TO_SLUG[name.toLowerCase()];
    if (slug && BRAND_BY_SLUG[slug]) {
      return BRAND_BY_SLUG[slug];
    }
    const lowerName = name.toLowerCase();
    for (const [key, val] of Object.entries(NAME_TO_SLUG)) {
      if (lowerName.includes(key.toLowerCase()) && BRAND_BY_SLUG[val]) {
        return BRAND_BY_SLUG[val];
      }
    }
  }

  if (input.familyType === "tariff") {
    return {
      ...DEFAULT_BRAND,
      category: "mobile_tariffs" as const,
      monogram: "📱"
    };
  }

  return DEFAULT_BRAND;
}

export function serviceIconUrl(iconSlug: string, color = "ffffff") {
  return `https://cdn.simpleicons.org/${iconSlug}/${color.replace("#", "")}`;
}
