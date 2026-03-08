import { getToken, clearToken } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

if (!API_BASE) {
  // This will show clearly during dev build
  console.warn("Missing NEXT_PUBLIC_API_URL env var");
}

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function api<T>(
  path: string,
  opts?: {
    method?: HttpMethod;
    body?: unknown;
    auth?: boolean;
    signal?: AbortSignal;
  }
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const method = opts?.method ?? "GET";
  const isFormData =
    typeof FormData !== "undefined" && opts?.body instanceof FormData;

  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (opts?.auth !== false) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body:
      opts?.body === undefined
        ? undefined
        : isFormData
        ? (opts.body as FormData)
        : JSON.stringify(opts.body),
    signal: opts?.signal,
    cache: "no-store",
  });

  // Handle 401 globally
  if (res.status === 401) {
    clearToken();
    throw new ApiError("No autorizado", 401);
  }

  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    const rawMsg =
      (data && (data.message || data.detail)) ||
      `La solicitud fallo (${res.status})`;
    const msg = normalizeApiErrorMessage(String(rawMsg), res.status);
    throw new ApiError(msg, res.status, data);
  }

  return data as T;
}

export async function apiMaybe<T>(
  path: string,
  opts?: {
    method?: HttpMethod;
    body?: unknown;
    auth?: boolean;
    signal?: AbortSignal;
  }
): Promise<T | null> {
  try {
    return await api<T>(path, opts);
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

function safeJsonParse(input: string) {
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
}

function normalizeApiErrorMessage(message: string, status: number): string {
  const trimmed = message.trim();
  const mapped = mapKnownApiError(trimmed);
  if (mapped) return mapped;
  if (!looksLikeEnglish(trimmed)) return trimmed;

  if (status === 404) return "No se encontro el recurso solicitado.";
  if (status === 429) return "Se alcanzo el limite de solicitudes. Intenta mas tarde.";
  if (status >= 500) {
    return "Ocurrio un error interno. Intenta nuevamente en unos minutos.";
  }
  return "No se pudo completar la operacion. Revisa los datos e intenta de nuevo.";
}

function mapKnownApiError(message: string): string | null {
  const maxDailyGroups = message.match(
    /^Rate limit reached: max (\d+) group generations with AI per day\.?$/i
  );
  if (maxDailyGroups) {
    return `Alcanzaste el limite diario de generaciones de zonas con IA (${maxDailyGroups[1]} por dia).`;
  }

  const mappings: Array<[RegExp, string]> = [
    [/^Tournament not found\.?$/i, "Torneo no encontrado."],
    [/^Team not found in this tournament\.?$/i, "No se encontro la pareja en este torneo."],
    [/^Player not found\.?$/i, "Jugador no encontrado."],
    [/^Email already registered\.?$/i, "Ese email ya esta registrado."],
    [/^Incorrect email or password\.?$/i, "Email o contrasena incorrectos."],
    [/^Use Google sign-in for this account\.?$/i, "Esta cuenta usa acceso con Google."],
    [/^Google authentication failed\.?$/i, "No se pudo validar el acceso con Google."],
    [/^Google account email is not verified\.?$/i, "Tu cuenta de Google no tiene el email verificado."],
    [/^Google sign-in is not configured\.?$/i, "El acceso con Google no esta configurado."],
    [
      /^Email already linked to another Google account\.?$/i,
      "Ese email ya esta vinculado a otra cuenta de Google.",
    ],
    [/^Could not validate credentials\.?$/i, "No se pudo validar la sesion."],
    [/^Account inactive\.?$/i, "La cuenta esta inactiva."],
    [/^Admin access required\.?$/i, "Esta accion requiere permisos de administrador."],
    [
      /^Admin account cannot access this resource\.?$/i,
      "La cuenta de administrador no puede acceder a este recurso.",
    ],
    [/^Not enough teams to generate groups\.?$/i, "No hay suficientes parejas para generar zonas."],
    [
      /^Groups can only be generated when tournament is upcoming\.?$/i,
      "Las zonas solo se pueden generar cuando el torneo esta en estado proximo.",
    ],
    [
      /^Group generation cancelled by client\.?$/i,
      "Generacion cancelada por el usuario.",
    ],
    [
      /^Invalid schedule window format\.?$/i,
      "El formato de las ventanas horarias no es valido.",
    ],
    [/^Duplicate schedule window date\.?$/i, "Hay fechas de ventana horaria repetidas."],
    [
      /^Schedule window start_time must be before end_time\.?$/i,
      "En cada ventana horaria, el inicio debe ser anterior al fin.",
    ],
    [
      /^Unable to assign match schedule within available windows respecting constraints\.?$/i,
      "No fue posible programar todos los partidos respetando las restricciones horarias.",
    ],
    [
      /^OpenAI request failed.*$/i,
      "No se pudo generar con IA en este intento. Intenta nuevamente.",
    ],
    [
      /^OpenAI response.*$/i,
      "La respuesta de IA no fue valida en este intento. Intenta nuevamente.",
    ],
    [
      /^LLM schedule invalid:.*$/i,
      "La propuesta de IA no cumplio las validaciones de horario.",
    ],
  ];

  for (const [pattern, replacement] of mappings) {
    if (pattern.test(message)) return replacement;
  }
  return null;
}

function looksLikeEnglish(message: string): boolean {
  const englishSignals = [
    /\bnot found\b/i,
    /\bfailed\b/i,
    /\bmust\b/i,
    /\bcannot\b/i,
    /\bonly\b/i,
    /\binvalid\b/i,
    /\bwhile\b/i,
    /\bupcoming\b/i,
    /\btournament\b/i,
    /\bgroup\b/i,
    /\bteam\b/i,
    /\bplayer\b/i,
    /\brate limit\b/i,
    /\brequest\b/i,
    /\bresponse\b/i,
    /\bmissing\b/i,
  ];
  return englishSignals.some((pattern) => pattern.test(message));
}
