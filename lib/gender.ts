export const GENDER_OPTIONS = [
  { value: "masculino", label: "Masculino" },
  { value: "damas", label: "Damas" },
  { value: "mixto", label: "Mixto" },
] as const;

export function normalizeGenderValue(value: string | null | undefined) {
  const normalized = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  if (!normalized) return "";
  if (["damas", "femenino", "mujer", "f"].includes(normalized)) return "damas";
  if (["masculino", "caballeros", "hombre", "m"].includes(normalized)) return "masculino";
  if (["mixto", "mixta", "mixed", "mix"].includes(normalized)) return "mixto";
  return normalized;
}

export function genderLabel(value: string | null | undefined, fallback = "") {
  const normalized = normalizeGenderValue(value);
  if (normalized === "damas") return "Damas";
  if (normalized === "masculino") return "Masculino";
  if (normalized === "mixto") return "Mixto";
  if (value) return value;
  return fallback;
}
