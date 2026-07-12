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
  category: ServiceCategory;
  monogram: string;
};

const BRAND_BY_SLUG: Record<string, ServiceBrand> = {
  "netflix-premium": { color: "#E50914", iconSlug: "netflix", category: "video_streaming", monogram: "N" },
  "youtube-premium": { color: "#FF0000", iconSlug: "youtube", category: "video_streaming", monogram: "YT" },
  "hbo-max": { color: "#5B2D82", iconSlug: "hbomax", category: "video_streaming", monogram: "H" },
  "yandex-plus": { color: "#FC3F1D", iconSlug: "yandex", category: "video_streaming", monogram: "Я" },
  ivi: { color: "#FF3B30", iconSlug: null, category: "video_streaming", monogram: "IV" },
  megogo: { color: "#00A0E3", iconSlug: null, category: "video_streaming", monogram: "M" },
  qino: { color: "#6C5CE7", iconSlug: null, category: "video_streaming", monogram: "Q" },
  okko: { color: "#111111", iconSlug: null, category: "video_streaming", monogram: "O" },
  amediateka: { color: "#E31E24", iconSlug: null, category: "video_streaming", monogram: "A" },
  "prime-video": { color: "#00A8E1", iconSlug: "prime", category: "video_streaming", monogram: "P" },
  "disney-plus": { color: "#113CCF", iconSlug: "disneyplus", category: "video_streaming", monogram: "D+" },
  crunchyroll: { color: "#F47521", iconSlug: "crunchyroll", category: "video_streaming", monogram: "CR" },
  "ilook-tv": { color: "#2563EB", iconSlug: null, category: "video_streaming", monogram: "iL" },
  "spotify-family": { color: "#1DB954", iconSlug: "spotify", category: "music_audio", monogram: "S" },
  "apple-music": { color: "#FA243C", iconSlug: "applemusic", category: "music_audio", monogram: "♫" },
  "duolingo-super": { color: "#58CC02", iconSlug: "duolingo", category: "education_books", monogram: "D" },
  "duolingo-max": { color: "#58CC02", iconSlug: "duolingo", category: "education_books", monogram: "D" },
  "mybook-premium": { color: "#7C3AED", iconSlug: null, category: "education_books", monogram: "MB" },
  "microsoft-365-family": {
    color: "#00A4EF",
    iconSlug: null,
    category: "cloud_productivity",
    monogram: "365"
  },
  "apple-one": { color: "#111111", iconSlug: "apple", category: "cloud_productivity", monogram: "" },
  "icloud-plus-2tb": { color: "#3693F3", iconSlug: "icloud", category: "cloud_productivity", monogram: "iC" },
  "google-one": { color: "#4285F4", iconSlug: "google", category: "cloud_productivity", monogram: "G" },
  "kaspersky-standard": { color: "#006D5C", iconSlug: "kaspersky", category: "security_utilities", monogram: "K" },
  "kaspersky-vpn": { color: "#006D5C", iconSlug: "kaspersky", category: "security_utilities", monogram: "K" },
  "adguard-vpn": { color: "#68BC71", iconSlug: "adguard", category: "security_utilities", monogram: "AG" },
  awax: { color: "#4F46E5", iconSlug: null, category: "security_utilities", monogram: "A" },
  "beeline-family-tariff": { color: "#FFC800", iconSlug: null, category: "mobile_tariffs", monogram: "B" },
  "tele2-family-tariff": { color: "#000000", iconSlug: null, category: "mobile_tariffs", monogram: "T2" },
  "altel-family-tariff": { color: "#E4002B", iconSlug: null, category: "mobile_tariffs", monogram: "A" },
  "kcell-family-tariff": { color: "#6B21A8", iconSlug: null, category: "mobile_tariffs", monogram: "K" },
  "activ-family-tariff": { color: "#E11D48", iconSlug: null, category: "mobile_tariffs", monogram: "ac" }
};

const NAME_TO_SLUG: Record<string, string> = {
  Netflix: "netflix-premium",
  "YouTube Premium": "youtube-premium",
  "HBO Max": "hbo-max",
  "Яндекс Плюс": "yandex-plus",
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
  "Apple Music": "apple-music",
  Duolingo: "duolingo-super",
  MyBook: "mybook-premium",
  "Microsoft 365": "microsoft-365-family",
  "Apple One": "apple-one",
  "iCloud+": "icloud-plus-2tb",
  "Google One": "google-one",
  Kaspersky: "kaspersky-standard",
  "Kaspersky VPN": "kaspersky-vpn",
  "AdGuard VPN": "adguard-vpn",
  Awax: "awax",
  Beeline: "beeline-family-tariff",
  Tele2: "tele2-family-tariff",
  Altel: "altel-family-tariff",
  Kcell: "kcell-family-tariff",
  activ: "activ-family-tariff"
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
  if (input.serviceSlug && BRAND_BY_SLUG[input.serviceSlug]) {
    return BRAND_BY_SLUG[input.serviceSlug];
  }

  const name = input.serviceName?.trim();
  if (name) {
    const slug = NAME_TO_SLUG[name];
    if (slug && BRAND_BY_SLUG[slug]) {
      return BRAND_BY_SLUG[slug];
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

export function serviceIconUrl(iconSlug: string) {
  return `https://cdn.simpleicons.org/${iconSlug}/ffffff`;
}
