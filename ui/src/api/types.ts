export type RolesMap = Record<string, string[]>;

export interface AuditRecord {
  timestamp: string;
  identity: string;
  action: string;
  resource: string | null;
  allowed: boolean;
}

export interface SessionTokenResponse {
  access_token: string;
  token_type: string;
}

export interface AttemptResult {
  status: number;
  body: unknown;
  /** Seconds the gateway asked us to wait (Retry-After), when it sent one. */
  retryAfterSeconds?: number;
}

/**
 * How the console presents a response. 401/403 are the policy layer saying
 * no (an expected, informative outcome); 429 and gateway 5xx are the
 * protection layer shedding load, a different story that must not be shown
 * as a permission denial.
 */
export type ResultKind = "allowed" | "denied" | "rate_limited" | "unavailable";

export function classifyStatus(status: number): ResultKind {
  if (status === 429) return "rate_limited";
  if (status === 502 || status === 503 || status === 504) return "unavailable";
  return status < 400 ? "allowed" : "denied";
}

/** Retry-After as whole seconds. Accepts only the delta-seconds form. */
export function parseRetryAfter(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value.trim())) return undefined;
  return Math.max(1, parseInt(value.trim(), 10));
}
