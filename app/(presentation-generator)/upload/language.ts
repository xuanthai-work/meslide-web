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
 * Vietnamese display label for each language code. The `Record<LanguageType, …>`
 * shape forces compile-time completeness against the enum.
 */
export const LANGUAGE_LABEL: Record<LanguageType, string> = {
  [LanguageType.Auto]: "Tự động (mặc định Tiếng Anh)",
  [LanguageType.English]: "Tiếng Anh",
  [LanguageType.Spanish]: "Tiếng Tây Ban Nha",
  [LanguageType.French]: "Tiếng Pháp",
  [LanguageType.German]: "Tiếng Đức",
  [LanguageType.Portuguese]: "Tiếng Bồ Đào Nha",
  [LanguageType.Italian]: "Tiếng Ý",
  [LanguageType.Dutch]: "Tiếng Hà Lan",
  [LanguageType.Russian]: "Tiếng Nga",
  [LanguageType.ChineseSimplified]: "Tiếng Trung (Giản thể)",
  [LanguageType.ChineseTraditional]: "Tiếng Trung (Phồn thể)",
  [LanguageType.Japanese]: "Tiếng Nhật",
  [LanguageType.Korean]: "Tiếng Hàn",
  [LanguageType.Arabic]: "Tiếng Ả Rập",
  [LanguageType.Hindi]: "Tiếng Hindi",
  [LanguageType.Bengali]: "Tiếng Bengal",
  [LanguageType.Polish]: "Tiếng Ba Lan",
  [LanguageType.Czech]: "Tiếng Séc",
  [LanguageType.Slovak]: "Tiếng Slovakia",
  [LanguageType.Hungarian]: "Tiếng Hung-ga-ri",
  [LanguageType.Romanian]: "Tiếng Romania",
  [LanguageType.Bulgarian]: "Tiếng Bulgaria",
  [LanguageType.Greek]: "Tiếng Hy Lạp",
  [LanguageType.Serbian]: "Tiếng Serbia",
  [LanguageType.Croatian]: "Tiếng Croatia",
  [LanguageType.Bosnian]: "Tiếng Bosnia",
  [LanguageType.Slovenian]: "Tiếng Slovenia",
  [LanguageType.Finnish]: "Tiếng Phần Lan",
  [LanguageType.Swedish]: "Tiếng Thụy Điển",
  [LanguageType.Danish]: "Tiếng Đan Mạch",
  [LanguageType.Norwegian]: "Tiếng Na Uy",
  [LanguageType.Icelandic]: "Tiếng Iceland",
  [LanguageType.Lithuanian]: "Tiếng Litva",
  [LanguageType.Latvian]: "Tiếng Latvia",
  [LanguageType.Estonian]: "Tiếng Estonia",
  [LanguageType.Maltese]: "Tiếng Malta",
  [LanguageType.Welsh]: "Tiếng Wales",
  [LanguageType.Irish]: "Tiếng Ireland",
  [LanguageType.ScottishGaelic]: "Tiếng Gael Scotland",
  [LanguageType.Ukrainian]: "Tiếng Ukraina",
  [LanguageType.Hebrew]: "Tiếng Do Thái",
  [LanguageType.Persian]: "Tiếng Ba Tư (Farsi)",
  [LanguageType.Turkish]: "Tiếng Thổ Nhĩ Kỳ",
  [LanguageType.Kurdish]: "Tiếng Kurd",
  [LanguageType.Pashto]: "Tiếng Pashto",
  [LanguageType.Dari]: "Tiếng Dari",
  [LanguageType.Uzbek]: "Tiếng Uzbek",
  [LanguageType.Kazakh]: "Tiếng Kazakh",
  [LanguageType.Tajik]: "Tiếng Tajik",
  [LanguageType.Turkmen]: "Tiếng Turkmen",
  [LanguageType.Azerbaijani]: "Tiếng Azerbaijan",
  [LanguageType.Urdu]: "Tiếng Urdu",
  [LanguageType.Tamil]: "Tiếng Tamil",
  [LanguageType.Telugu]: "Tiếng Telugu",
  [LanguageType.Marathi]: "Tiếng Marathi",
  [LanguageType.Punjabi]: "Tiếng Punjab",
  [LanguageType.Gujarati]: "Tiếng Gujarat",
  [LanguageType.Malayalam]: "Tiếng Malayalam",
  [LanguageType.Kannada]: "Tiếng Kannada",
  [LanguageType.Odia]: "Tiếng Odia",
  [LanguageType.Sinhala]: "Tiếng Sinhala",
  [LanguageType.Nepali]: "Tiếng Nepal",
  [LanguageType.Thai]: "Tiếng Thái",
  [LanguageType.Vietnamese]: "Tiếng Việt",
  [LanguageType.Lao]: "Tiếng Lào",
  [LanguageType.Khmer]: "Tiếng Khmer",
  [LanguageType.Burmese]: "Tiếng Miến Điện",
  [LanguageType.Tagalog]: "Tiếng Tagalog (Filipino)",
  [LanguageType.Javanese]: "Tiếng Java",
  [LanguageType.Sundanese]: "Tiếng Sunda",
  [LanguageType.Malay]: "Tiếng Mã Lai",
  [LanguageType.Mongolian]: "Tiếng Mông Cổ",
  [LanguageType.Swahili]: "Tiếng Swahili",
  [LanguageType.Hausa]: "Tiếng Hausa",
  [LanguageType.Yoruba]: "Tiếng Yoruba",
  [LanguageType.Igbo]: "Tiếng Igbo",
  [LanguageType.Amharic]: "Tiếng Amhara",
  [LanguageType.Zulu]: "Tiếng Zulu",
  [LanguageType.Xhosa]: "Tiếng Xhosa",
  [LanguageType.Shona]: "Tiếng Shona",
  [LanguageType.Somali]: "Tiếng Somali",
  [LanguageType.Basque]: "Tiếng Basque",
  [LanguageType.Catalan]: "Tiếng Catalan",
  [LanguageType.Galician]: "Tiếng Galicia",
  [LanguageType.Quechua]: "Tiếng Quechua",
  [LanguageType.Nahuatl]: "Tiếng Nahuatl",
  [LanguageType.Hawaiian]: "Tiếng Hawaii",
  [LanguageType.Maori]: "Tiếng Maori",
  [LanguageType.Tahitian]: "Tiếng Tahiti",
  [LanguageType.Samoan]: "Tiếng Samoa",
};