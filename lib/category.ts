const CATEGORY_NUMBER_MAP: Record<string, string> = {
  "1": "1ra",
  "2": "2da",
  "3": "3ra",
  "4": "4ta",
  "5": "5ta",
  "6": "6ta",
  "7": "7ma",
  "8": "8va",
};

const CATEGORY_ALIAS_MAP: Record<string, string> = {
  ...CATEGORY_NUMBER_MAP,
  "1ra": "1ra",
  "1era": "1ra",
  primera: "1ra",
  "2da": "2da",
  segunda: "2da",
  "3ra": "3ra",
  tercera: "3ra",
  "4ta": "4ta",
  cuarta: "4ta",
  "5ta": "5ta",
  quinta: "5ta",
  "6ta": "6ta",
  sexta: "6ta",
  "7ma": "7ma",
  "7a": "7ma",
  septima: "7ma",
  séptima: "7ma",
  "8va": "8va",
  "8a": "8va",
  octava: "8va",
};

export const CATEGORY_SUGGESTIONS = [
  "8va",
  "7ma",
  "6ta",
  "5ta",
  "4ta",
  "3ra",
  "2da",
  "1ra",
  "suma 7",
  "suma 8",
  "suma 9",
  "suma 10",
  "suma 11",
  "suma 12",
  "suma 13",
] as const;

function normalizeCategoryKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizeCategoryValue(value: string | null | undefined) {
  const cleaned = (value ?? "").trim().replace(/\s+/g, " ");
  const normalized = normalizeCategoryKey(cleaned);

  if (!normalized) return "";

  const sumMatch = normalized.match(/^(?:s|suma)(?:\s+de)?\s*(\d{1,2})$/);
  if (sumMatch) {
    return `suma ${Number(sumMatch[1])}`;
  }

  if (/^\d{1,2}$/.test(normalized)) {
    if (normalized in CATEGORY_NUMBER_MAP) return CATEGORY_NUMBER_MAP[normalized];
    return `suma ${Number(normalized)}`;
  }

  if (normalized in CATEGORY_ALIAS_MAP) {
    return CATEGORY_ALIAS_MAP[normalized];
  }

  return cleaned.toLowerCase();
}
