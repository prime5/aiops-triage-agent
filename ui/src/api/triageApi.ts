import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { ActionDef } from "./actions";
import type { AttemptResult, AuditRecord, RolesMap, SessionTokenResponse } from "./types";

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
          return { data: { status: response.status, body } };
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
