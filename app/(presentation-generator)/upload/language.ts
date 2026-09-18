import type { MessageKey } from "@/i18n/types";

/**
 * The presentation-content language. Declared as a const object (not a
 * `enum`) so the declaration is erasable TypeScript: the Node 22
 * type-stripping test runner loads this file directly
 * (tests/presentation-language.test.mjs), and strip-only mode cannot parse
 * non-erasable `enum` syntax. `type.ts` re-exports it so existing
 * `from "../type"` imports keep working; member names and order are exactly
 * those of the pre-Phase-4 enum, with stable lowercase snake_case codes as
 * values (FR-6). The API wire format is the legacy display string — see
 * LEGACY_LANGUAGE_VALUE below.
 */
export const LanguageType = {
  // Major World Languages
  Auto: "auto",
  English: "english",
  Spanish: "spanish",
  French: "french",
  German: "german",
  Portuguese: "portuguese",
  Italian: "italian",
  Dutch: "dutch",
  Russian: "russian",
  ChineseSimplified: "chinese_simplified",
  ChineseTraditional: "chinese_traditional",
  Japanese: "japanese",
  Korean: "korean",
  Arabic: "arabic",
  Hindi: "hindi",
  Bengali: "bengali",

  // European Languages
  Polish: "polish",
  Czech: "czech",
  Slovak: "slovak",
  Hungarian: "hungarian",
  Romanian: "romanian",
  Bulgarian: "bulgarian",
  Greek: "greek",
  Serbian: "serbian",
  Croatian: "croatian",
  Bosnian: "bosnian",
  Slovenian: "slovenian",
  Finnish: "finnish",
  Swedish: "swedish",
  Danish: "danish",
  Norwegian: "norwegian",
  Icelandic: "icelandic",
  Lithuanian: "lithuanian",
  Latvian: "latvian",
  Estonian: "estonian",
  Maltese: "maltese",
  Welsh: "welsh",
  Irish: "irish",
  ScottishGaelic: "scottish_gaelic",
  Ukrainian: "ukrainian",

  // Middle Eastern and Central Asian Languages
  Hebrew: "hebrew",
  Persian: "persian",
  Turkish: "turkish",
  Kurdish: "kurdish",
  Pashto: "pashto",
  Dari: "dari",
  Uzbek: "uzbek",
  Kazakh: "kazakh",
  Tajik: "tajik",
  Turkmen: "turkmen",
  Azerbaijani: "azerbaijani",

  // South Asian Languages
  Urdu: "urdu",
  Tamil: "tamil",
  Telugu: "telugu",
  Marathi: "marathi",
  Punjabi: "punjabi",
  Gujarati: "gujarati",
  Malayalam: "malayalam",
  Kannada: "kannada",
  Odia: "odia",
  Sinhala: "sinhala",
  Nepali: "nepali",

  // East and Southeast Asian Languages
  Thai: "thai",
  Vietnamese: "vietnamese",
  Lao: "lao",
  Khmer: "khmer",
  Burmese: "burmese",
  Tagalog: "tagalog",
  Javanese: "javanese",
  Sundanese: "sundanese",
  Malay: "malay",
  Mongolian: "mongolian",

  // African Languages
  Swahili: "swahili",
  Hausa: "hausa",
  Yoruba: "yoruba",
  Igbo: "igbo",
  Amharic: "amharic",
  Zulu: "zulu",
  Xhosa: "xhosa",
  Shona: "shona",
  Somali: "somali",

  // Indigenous and Lesser-Known Languages
  Basque: "basque",
  Catalan: "catalan",
  Galician: "galician",
  Quechua: "quechua",
  Nahuatl: "nahuatl",
  Hawaiian: "hawaiian",
  Maori: "maori",
  Tahitian: "tahitian",
  Samoan: "samoan",
} as const;

export type LanguageType = (typeof LanguageType)[keyof typeof LanguageType];

/**
 * Legacy display strings that were the `LanguageType` values before Phase 4
 * replaced them with stable codes. These strings ARE the API wire format:
 * the backend keys off them (see
 * `gslide-api/servers/fastapi/utils/ocr_language.py`,
 * `PRESENTATION_LANGUAGE_TO_TESSERACT`), so they must stay in sync with that
 * backend map and be sent unchanged by the API boundary
 * (`services/api/presentation-generation.ts`).
 *
 * Every value below was copied verbatim from the pre-change enum. "Auto
 * (English)" has no OCR entry on the backend but is kept because the
 * generation APIs receive it too.
 */
export const LEGACY_LANGUAGE_VALUE: Record<LanguageType, string> = {
  // Major World Languages
  [LanguageType.Auto]: "Auto (English)",
  [LanguageType.English]: "English",
  [LanguageType.Spanish]: "Spanish (Español)",
  [LanguageType.French]: "French (Français)",
  [LanguageType.German]: "German (Deutsch)",
  [LanguageType.Portuguese]: "Portuguese (Português)",
  [LanguageType.Italian]: "Italian (Italiano)",
  [LanguageType.Dutch]: "Dutch (Nederlands)",
  [LanguageType.Russian]: "Russian (Русский)",
  [LanguageType.ChineseSimplified]: "Chinese (Simplified - 中文, 汉语)",
  [LanguageType.ChineseTraditional]: "Chinese (Traditional - 中文, 漢語)",
  [LanguageType.Japanese]: "Japanese (日本語)",
  [LanguageType.Korean]: "Korean (한국어)",
  [LanguageType.Arabic]: "Arabic (العربية)",
  [LanguageType.Hindi]: "Hindi (हिन्दी)",
  [LanguageType.Bengali]: "Bengali (বাংলা)",

  // European Languages
  [LanguageType.Polish]: "Polish (Polski)",
  [LanguageType.Czech]: "Czech (Čeština)",
  [LanguageType.Slovak]: "Slovak (Slovenčina)",
  [LanguageType.Hungarian]: "Hungarian (Magyar)",
  [LanguageType.Romanian]: "Romanian (Română)",
  [LanguageType.Bulgarian]: "Bulgarian (Български)",
  [LanguageType.Greek]: "Greek (Ελληνικά)",
  [LanguageType.Serbian]: "Serbian (Српски / Srpski)",
  [LanguageType.Croatian]: "Croatian (Hrvatski)",
  [LanguageType.Bosnian]: "Bosnian (Bosanski)",
  [LanguageType.Slovenian]: "Slovenian (Slovenščina)",
  [LanguageType.Finnish]: "Finnish (Suomi)",
  [LanguageType.Swedish]: "Swedish (Svenska)",
  [LanguageType.Danish]: "Danish (Dansk)",
  [LanguageType.Norwegian]: "Norwegian (Norsk)",
  [LanguageType.Icelandic]: "Icelandic (Íslenska)",
  [LanguageType.Lithuanian]: "Lithuanian (Lietuvių)",
  [LanguageType.Latvian]: "Latvian (Latviešu)",
  [LanguageType.Estonian]: "Estonian (Eesti)",
  [LanguageType.Maltese]: "Maltese (Malti)",
  [LanguageType.Welsh]: "Welsh (Cymraeg)",
  [LanguageType.Irish]: "Irish (Gaeilge)",
  [LanguageType.ScottishGaelic]: "Scottish Gaelic (Gàidhlig)",
  [LanguageType.Ukrainian]: "Ukrainian (Українська)",

  // Middle Eastern and Central Asian Languages
  [LanguageType.Hebrew]: "Hebrew (עברית)",
  [LanguageType.Persian]: "Persian/Farsi (فارسی)",
  [LanguageType.Turkish]: "Turkish (Türkçe)",
  [LanguageType.Kurdish]: "Kurdish (Kurdî / کوردی)",
  [LanguageType.Pashto]: "Pashto (پښتو)",
  [LanguageType.Dari]: "Dari (دری)",
  [LanguageType.Uzbek]: "Uzbek (Oʻzbek)",
  [LanguageType.Kazakh]: "Kazakh (Қазақша)",
  [LanguageType.Tajik]: "Tajik (Тоҷикӣ)",
  [LanguageType.Turkmen]: "Turkmen (Türkmençe)",
  [LanguageType.Azerbaijani]: "Azerbaijani (Azərbaycan dili)",

  // South Asian Languages
  [LanguageType.Urdu]: "Urdu (اردو)",
  [LanguageType.Tamil]: "Tamil (தமிழ்)",
  [LanguageType.Telugu]: "Telugu (తెలుగు)",
  [LanguageType.Marathi]: "Marathi (मराठी)",
  [LanguageType.Punjabi]: "Punjabi (ਪੰਜਾਬੀ / پنجابی)",
  [LanguageType.Gujarati]: "Gujarati (ગુજરાતી)",
  [LanguageType.Malayalam]: "Malayalam (മലയാളം)",
  [LanguageType.Kannada]: "Kannada (ಕನ್ನಡ)",
  [LanguageType.Odia]: "Odia (ଓଡ଼ିଆ)",
  [LanguageType.Sinhala]: "Sinhala (සිංහල)",
  [LanguageType.Nepali]: "Nepali (नेपाली)",

  // East and Southeast Asian Languages
  [LanguageType.Thai]: "Thai (ไทย)",
  [LanguageType.Vietnamese]: "Vietnamese (Tiếng Việt)",
  [LanguageType.Lao]: "Lao (ລາວ)",
  [LanguageType.Khmer]: "Khmer (ភាសាខ្មែរ)",
  [LanguageType.Burmese]: "Burmese (မြန်မာစာ)",
  [LanguageType.Tagalog]: "Tagalog/Filipino (Tagalog/Filipino)",
  [LanguageType.Javanese]: "Javanese (Basa Jawa)",
  [LanguageType.Sundanese]: "Sundanese (Basa Sunda)",
  [LanguageType.Malay]: "Malay (Bahasa Melayu)",
  [LanguageType.Mongolian]: "Mongolian (Монгол)",

  // African Languages
  [LanguageType.Swahili]: "Swahili (Kiswahili)",
  [LanguageType.Hausa]: "Hausa (Hausa)",
  [LanguageType.Yoruba]: "Yoruba (Yorùbá)",
  [LanguageType.Igbo]: "Igbo (Igbo)",
  [LanguageType.Amharic]: "Amharic (አማርኛ)",
  [LanguageType.Zulu]: "Zulu (isiZulu)",
  [LanguageType.Xhosa]: "Xhosa (isiXhosa)",
  [LanguageType.Shona]: "Shona (ChiShona)",
  [LanguageType.Somali]: "Somali (Soomaaliga)",

  // Indigenous and Lesser-Known Languages
  [LanguageType.Basque]: "Basque (Euskara)",
  [LanguageType.Catalan]: "Catalan (Català)",
  [LanguageType.Galician]: "Galician (Galego)",
  [LanguageType.Quechua]: "Quechua (Runasimi)",
  [LanguageType.Nahuatl]: "Nahuatl (Nāhuatl)",
  [LanguageType.Hawaiian]: "Hawaiian (ʻŌlelo Hawaiʻi)",
  [LanguageType.Maori]: "Maori (Te Reo Māori)",
  [LanguageType.Tahitian]: "Tahitian (Reo Tahiti)",
  [LanguageType.Samoan]: "Samoan (Gagana Samoa)",
};

/**
 * Map a stable language code to the legacy display string the APIs expect.
 * Returns `null` for absent input (callers send `language: null` upstream).
 */
export function toLegacyLanguageValue(
  value: LanguageType | null | undefined
): string | null {
  return value ? LEGACY_LANGUAGE_VALUE[value] ?? null : null;
}

/**
 * Parse a raw language value into a stable {@link LanguageType} code. Accepts
 * either a new stable code (e.g. "vietnamese") or a legacy display string
 * (e.g. "Vietnamese (Tiếng Việt)") — the backward-compatibility entry point
 * for values saved before Phase 4. Returns `null` for anything unrecognized.
 */
export function parseLanguageValue(
  raw: string | null | undefined
): LanguageType | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (Object.values(LanguageType).includes(trimmed as LanguageType)) {
    return trimmed as LanguageType;
  }
  for (const [code, legacy] of Object.entries(LEGACY_LANGUAGE_VALUE)) {
    if (legacy === trimmed) {
      return code as LanguageType;
    }
  }
  return null;
}

/**
 * Catalog key holding the localized display label for each language. The
 * `Record<LanguageType, …>` shape forces compile-time completeness against
 * the enum, and `MessageKey<typeof vi>` guarantees the keys exist in the
 * default catalog.
 */
export const LANGUAGE_LABEL_KEY: Record<
  LanguageType,
  MessageKey<typeof import("@/i18n/locales/vi").default>
> = {
  [LanguageType.Auto]: "upload.language.auto",
  [LanguageType.English]: "upload.language.english",
  [LanguageType.Spanish]: "upload.language.spanish",
  [LanguageType.French]: "upload.language.french",
  [LanguageType.German]: "upload.language.german",
  [LanguageType.Portuguese]: "upload.language.portuguese",
  [LanguageType.Italian]: "upload.language.italian",
  [LanguageType.Dutch]: "upload.language.dutch",
  [LanguageType.Russian]: "upload.language.russian",
  [LanguageType.ChineseSimplified]: "upload.language.chineseSimplified",
  [LanguageType.ChineseTraditional]: "upload.language.chineseTraditional",
  [LanguageType.Japanese]: "upload.language.japanese",
  [LanguageType.Korean]: "upload.language.korean",
  [LanguageType.Arabic]: "upload.language.arabic",
  [LanguageType.Hindi]: "upload.language.hindi",
  [LanguageType.Bengali]: "upload.language.bengali",
  [LanguageType.Polish]: "upload.language.polish",
  [LanguageType.Czech]: "upload.language.czech",
  [LanguageType.Slovak]: "upload.language.slovak",
  [LanguageType.Hungarian]: "upload.language.hungarian",
  [LanguageType.Romanian]: "upload.language.romanian",
  [LanguageType.Bulgarian]: "upload.language.bulgarian",
  [LanguageType.Greek]: "upload.language.greek",
  [LanguageType.Serbian]: "upload.language.serbian",
  [LanguageType.Croatian]: "upload.language.croatian",
  [LanguageType.Bosnian]: "upload.language.bosnian",
  [LanguageType.Slovenian]: "upload.language.slovenian",
  [LanguageType.Finnish]: "upload.language.finnish",
  [LanguageType.Swedish]: "upload.language.swedish",
  [LanguageType.Danish]: "upload.language.danish",
  [LanguageType.Norwegian]: "upload.language.norwegian",
  [LanguageType.Icelandic]: "upload.language.icelandic",
  [LanguageType.Lithuanian]: "upload.language.lithuanian",
  [LanguageType.Latvian]: "upload.language.latvian",
  [LanguageType.Estonian]: "upload.language.estonian",
  [LanguageType.Maltese]: "upload.language.maltese",
  [LanguageType.Welsh]: "upload.language.welsh",
  [LanguageType.Irish]: "upload.language.irish",
  [LanguageType.ScottishGaelic]: "upload.language.scottishGaelic",
  [LanguageType.Ukrainian]: "upload.language.ukrainian",
  [LanguageType.Hebrew]: "upload.language.hebrew",
  [LanguageType.Persian]: "upload.language.persian",
  [LanguageType.Turkish]: "upload.language.turkish",
  [LanguageType.Kurdish]: "upload.language.kurdish",
  [LanguageType.Pashto]: "upload.language.pashto",
  [LanguageType.Dari]: "upload.language.dari",
  [LanguageType.Uzbek]: "upload.language.uzbek",
  [LanguageType.Kazakh]: "upload.language.kazakh",
  [LanguageType.Tajik]: "upload.language.tajik",
  [LanguageType.Turkmen]: "upload.language.turkmen",
  [LanguageType.Azerbaijani]: "upload.language.azerbaijani",
  [LanguageType.Urdu]: "upload.language.urdu",
  [LanguageType.Tamil]: "upload.language.tamil",
  [LanguageType.Telugu]: "upload.language.telugu",
  [LanguageType.Marathi]: "upload.language.marathi",
  [LanguageType.Punjabi]: "upload.language.punjabi",
  [LanguageType.Gujarati]: "upload.language.gujarati",
  [LanguageType.Malayalam]: "upload.language.malayalam",
  [LanguageType.Kannada]: "upload.language.kannada",
  [LanguageType.Odia]: "upload.language.odia",
  [LanguageType.Sinhala]: "upload.language.sinhala",
  [LanguageType.Nepali]: "upload.language.nepali",
  [LanguageType.Thai]: "upload.language.thai",
  [LanguageType.Vietnamese]: "upload.language.vietnamese",
  [LanguageType.Lao]: "upload.language.lao",
  [LanguageType.Khmer]: "upload.language.khmer",
  [LanguageType.Burmese]: "upload.language.burmese",
  [LanguageType.Tagalog]: "upload.language.tagalog",
  [LanguageType.Javanese]: "upload.language.javanese",
  [LanguageType.Sundanese]: "upload.language.sundanese",
  [LanguageType.Malay]: "upload.language.malay",
  [LanguageType.Mongolian]: "upload.language.mongolian",
  [LanguageType.Swahili]: "upload.language.swahili",
  [LanguageType.Hausa]: "upload.language.hausa",
  [LanguageType.Yoruba]: "upload.language.yoruba",
  [LanguageType.Igbo]: "upload.language.igbo",
  [LanguageType.Amharic]: "upload.language.amharic",
  [LanguageType.Zulu]: "upload.language.zulu",
  [LanguageType.Xhosa]: "upload.language.xhosa",
  [LanguageType.Shona]: "upload.language.shona",
  [LanguageType.Somali]: "upload.language.somali",
  [LanguageType.Basque]: "upload.language.basque",
  [LanguageType.Catalan]: "upload.language.catalan",
  [LanguageType.Galician]: "upload.language.galician",
  [LanguageType.Quechua]: "upload.language.quechua",
  [LanguageType.Nahuatl]: "upload.language.nahuatl",
  [LanguageType.Hawaiian]: "upload.language.hawaiian",
  [LanguageType.Maori]: "upload.language.maori",
  [LanguageType.Tahitian]: "upload.language.tahitian",
  [LanguageType.Samoan]: "upload.language.samoan",
};