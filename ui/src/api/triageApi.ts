import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { ActionDef } from "./actions";
import {
  parseRetryAfter,
  type AttemptResult,
  type AuditRecord,
  type RolesMap,
  type SessionTokenResponse,
} from "./types";

// Direct to the FastAPI service by default. To go through the flowgate
// gateway instead, set VITE_API_BASE_URL=/api and run the dev server: see
// vite.config.ts (a same-origin proxy, so the gateway's own 429/503 replies,
// which carry no CORS headers, stay readable by the browser) and the README.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export const triageApi = createApi({
  reducerPath: "triageApi",
  baseQuery: fetchBaseQuery({ baseUrl: API_BASE_URL }),
  tagTypes: ["Audit"],
  endpoints: (builder) => ({
    getRoles: builder.query<RolesMap, void>({
      query: () => "/policy/roles",
    }),

    getAudit: builder.query<AuditRecord[], number | void>({
      query: (limit) => `/audit?limit=${limit ?? 200}`,
      providesTags: ["Audit"],
    }),

    mintSession: builder.mutation<SessionTokenResponse, string>({
      query: (identity) => ({
        url: `/auth/session?identity=${encodeURIComponent(identity)}`,
        method: "POST",
      }),
    }),

    attemptAction: builder.mutation<
      AttemptResult,
      { def: ActionDef; values: Record<string, string>; token: string }
    >({
      // custom queryFn: a 401/403 here is an expected, displayable outcome,
      // not a failed request, so we don't let RTK Query treat it as an error.
      // A thrown network error (backend unreachable, DNS failure, etc.) is a
      // real failure, though — queryFn must never throw, so it's converted
      // into an explicit { error } result instead of an unhandled rejection.
      async queryFn({ def, values, token }) {
        const query = def.queryParams
          .map((name) => `${encodeURIComponent(name)}=${encodeURIComponent(values[name] ?? "")}`)
          .join("&");
        const path = def.buildPath(values);
        const url = `${API_BASE_URL}${path}${query ? `?${query}` : ""}`;

        try {
          const response = await fetch(url, {
            method: def.method,
            headers: { Authorization: `Bearer ${token}` },
          });
          const body = await response.json().catch(() => ({}));
          // 429 (rate limited) and 503 (shed / breaker open) come from the
          // flowgate gateway when it fronts the API. They are data, not
          // errors, and carry a Retry-After the console turns into a countdown.
          return {
            data: {
              status: response.status,
              body,
              retryAfterSeconds: parseRetryAfter(response.headers.get("Retry-After")),
            },
          };
        } catch (err) {
          return {
            error: {
              status: "FETCH_ERROR",
              error: err instanceof Error ? err.message : String(err),
            },
          };
        }
      },
      invalidatesTags: ["Audit"],
    }),
  }),
});

export const {
  useGetRolesQuery,
  useGetAuditQuery,
  useMintSessionMutation,
  useAttemptActionMutation,
} = triageApi;
