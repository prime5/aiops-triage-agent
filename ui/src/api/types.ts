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
}
