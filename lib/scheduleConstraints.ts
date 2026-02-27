const DAYS = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
] as const;

type DayName = (typeof DAYS)[number];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("á", "a")
    .replaceAll("é", "e")
    .replaceAll("í", "i")
    .replaceAll("ó", "o")
    .replaceAll("ú", "u")
    .replaceAll("ü", "u")
    .replace(/\s+/g, " ")
    .trim();
}

function dayExpr(day: DayName): string {
  return `${day}(?:\\s+\\d{1,4}(?:[/-]\\d{1,2})?)?`;
}

function parseHourMatch(match: RegExpMatchArray): { hour: number; minute: number } | null {
  const hour = Number(match[1] ?? "");
  const minute = Number(match[2] ?? "0");
  const meridiem = (match[3] ?? "").toLowerCase();
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (minute < 0 || minute > 59) return null;

  if (meridiem === "am" || meridiem === "pm") {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === "pm" && hour < 12) return { hour: hour + 12, minute };
    if (meridiem === "am" && hour === 12) return { hour: 0, minute };
    return { hour, minute };
  }

  if (hour < 0 || hour > 23) return null;
  return { hour, minute };
}

function parseAfterTime(text: string, day: DayName): number | null {
  const patterns = [
    new RegExp(
      `${dayExpr(day)}[\\s,.;:-]*(?:a\\s+partir\\s+de|despues\\s+de|desde)(?:\\s+las)?\\s*(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm|hs|h)?`,
      "g"
    ),
    new RegExp(
      `(?:a\\s+partir\\s+de|despues\\s+de|desde)(?:\\s+las)?\\s*(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm|hs|h)?\\s+(?:el\\s+)?${day}\\b`,
      "g"
    ),
  ];

  let maxMinutes: number | null = null;
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const parsed = parseHourMatch(match);
      if (!parsed) continue;
      const minutes = parsed.hour * 60 + parsed.minute;
      if (maxMinutes === null || minutes > maxMinutes) {
        maxMinutes = minutes;
      }
    }
  }
  return maxMinutes;
}

function hasDayBlock(text: string, day: DayName): boolean {
  const patterns = [
    new RegExp(`no\\s+(?:puede|pueden|juega|juegan|disponible(?:s)?)(?:\\s+el)?\\s+${day}\\b`),
    new RegExp(`${dayExpr(day)}[\\s,.;:-]*(?:no\\b|no\\s+(?:puede|pueden|juega|juegan|disponible(?:s)?))`),
    new RegExp(`sin\\s+(?:jugar\\s+)?${day}\\b`),
  ];
  return patterns.some((pattern) => pattern.test(text));
}

function extractExclusiveDays(text: string): Set<DayName> {
  const exclusiveDays = new Set<DayName>();
  const markers = "(?:solo|solamente|unicamente)";
  for (const day of DAYS) {
    const patterns = [
      new RegExp(`\\b${markers}\\s+(?:el\\s+)?${dayExpr(day)}\\b`),
      new RegExp(`\\b${dayExpr(day)}\\s+${markers}\\b`),
    ];
    if (patterns.some((pattern) => pattern.test(text))) {
      exclusiveDays.add(day);
    }
  }
  return exclusiveDays;
}

function weekdayFromIsoDate(isoDate: string): DayName | null {
  const [yearRaw, monthRaw, dayRaw] = isoDate.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(utcDate.getTime())) return null;
  const jsDay = utcDate.getUTCDay(); // 0=domingo ... 6=sabado
  const index = (jsDay + 6) % 7; // 0=lunes ... 6=domingo
  return DAYS[index] ?? null;
}

function toMinutes(timeValue: string): number | null {
  const [hourRaw, minuteRaw] = timeValue.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function isMatchAllowedByConstraints(
  constraints: string | null | undefined,
  scheduledDate: string | null | undefined,
  scheduledTime: string | null | undefined
): boolean {
  if (!constraints || !scheduledDate || !scheduledTime) return true;
  const text = normalizeText(constraints);
  if (!text) return true;

  const day = weekdayFromIsoDate(scheduledDate.slice(0, 10));
  if (!day) return true;
  const exclusiveDays = extractExclusiveDays(text);
  if (exclusiveDays.size > 0 && !exclusiveDays.has(day)) return false;
  if (exclusiveDays.size === 0 && !text.includes(day)) return true;

  if (hasDayBlock(text, day)) return false;
  if (new RegExp(`${day}\\s+sin\\s+problemas?`).test(text)) return true;

  const afterTimeMinutes = parseAfterTime(text, day);
  if (afterTimeMinutes !== null) {
    const slotMinutes = toMinutes(scheduledTime.slice(0, 5));
    if (slotMinutes === null) return true;
    if (slotMinutes < afterTimeMinutes) return false;
  }

  return true;
}
