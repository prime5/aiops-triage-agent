import { useMemo, useState } from "react";
import { useGetAuditQuery } from "../../api/triageApi";

type AllowedFilter = "all" | "allowed" | "denied";

export function AuditTable() {
  const { data: records = [] } = useGetAuditQuery(200, { pollingInterval: 1500 });
  const [identityFilter, setIdentityFilter] = useState("all");
  const [allowedFilter, setAllowedFilter] = useState<AllowedFilter>("all");

  const identities = useMemo(
    () => Array.from(new Set(records.map((r) => r.identity))).sort(),
    [records],
  );

  const filtered = useMemo(
    () =>
      records.filter((r) => {
        if (identityFilter !== "all" && r.identity !== identityFilter) return false;
        if (allowedFilter === "allowed" && !r.allowed) return false;
        if (allowedFilter === "denied" && r.allowed) return false;
        return true;
      }),
    [records, identityFilter, allowedFilter],
  );

  return (
    <div className="panel">
      <h2>Audit trail</h2>
      <p className="panel-hint">
        Every permission check, live. Polls the backend every 1.5s — no refresh needed.
      </p>

      <div className="field-row">
        <label>
          Identity
          <select value={identityFilter} onChange={(e) => setIdentityFilter(e.target.value)}>
            <option value="all">All identities</option>
            {identities.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Outcome
          <select
            value={allowedFilter}
            onChange={(e) => setAllowedFilter(e.target.value as AllowedFilter)}
          >
            <option value="all">All outcomes</option>
            <option value="allowed">Allowed only</option>
            <option value="denied">Denied only</option>
          </select>
        </label>
      </div>

      <div className="audit-table-wrap">
        <table className="audit-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Identity</th>
              <th>Action</th>
              <th>Resource</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-row">
                  No audit records yet — try an action above.
                </td>
              </tr>
            )}
            {filtered.map((r, i) => (
              <tr key={`${r.timestamp}-${i}`} className={i === 0 ? "row-newest" : ""}>
                <td className="mono">{new Date(r.timestamp).toLocaleTimeString()}</td>
                <td className="mono">{r.identity}</td>
                <td className="mono">{r.action}</td>
                <td className="mono">{r.resource ?? "—"}</td>
                <td>
                  <span className={`tag ${r.allowed ? "tag-allow" : "tag-deny"}`}>
                    {r.allowed ? "ALLOWED" : "DENIED"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
