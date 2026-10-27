import { useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { ACTION_DEFS } from "../../api/actions";
import { useAttemptActionMutation, useGetRolesQuery, useMintSessionMutation } from "../../api/triageApi";
import { classifyStatus, type AttemptResult, type ResultKind } from "../../api/types";
import { identityChanged, tokenMinted } from "../session/sessionSlice";

const RIBBON: Record<ResultKind, { className: string; tag: string }> = {
  allowed: { className: "result-allow", tag: "ALLOWED" },
  denied: { className: "result-deny", tag: "DENIED" },
  rate_limited: { className: "result-limited", tag: "RATE LIMITED" },
  unavailable: { className: "result-unavailable", tag: "GATEWAY UNAVAILABLE" },
};

export function ActionConsole() {
  const dispatch = useAppDispatch();
  const { identity, token } = useAppSelector((state) => state.session);
  const { data: roles } = useGetRolesQuery();
  const [mintSession, mintState] = useMintSessionMutation();
  const [attemptAction, attemptState] = useAttemptActionMutation();

  const [actionName, setActionName] = useState(ACTION_DEFS[0].action);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [attemptError, setAttemptError] = useState<string | null>(null);
  // seconds left before the gateway will accept another attempt (from Retry-After)
  const [cooldown, setCooldown] = useState(0);

  const identities = useMemo(() => Object.keys(roles ?? {}), [roles]);
  const actionDef = useMemo(
    () => ACTION_DEFS.find((def) => def.action === actionName) ?? ACTION_DEFS[0],
    [actionName],
  );

  // mint a fresh session token whenever the identity changes
  useEffect(() => {
    if (!identity) return;
    mintSession(identity)
      .unwrap()
      .then((res) => dispatch(tokenMinted(res.access_token)))
      .catch(() => {
        /* unknown identity — surfaced via mintState.error below */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    setFieldValues({});
    setResult(null);
    setAttemptError(null);
  }, [actionName]);

  const handleAttempt = async () => {
    if (!token) return;
    setAttemptError(null);
    setCooldown(0);
    try {
      const res = await attemptAction({ def: actionDef, values: fieldValues, token }).unwrap();
      setResult(res);
      setCooldown(res.retryAfterSeconds ?? 0);
    } catch {
      setResult(null);
      setAttemptError("Couldn't reach the server. Check that the backend is running and try again.");
    }
  };

  const missingFields = actionDef.fields.filter((f) => !fieldValues[f.name]?.trim());
  const canAttempt = Boolean(token) && missingFields.length === 0 && cooldown === 0;
  const kind = result ? classifyStatus(result.status) : null;

  return (
    <div className="panel">
      <h2>Try an action</h2>
      <p className="panel-hint">
        Pick an identity and an action — including mismatched pairs — and fire it against the
        real backend to see the permission check happen live.
      </p>

      <div className="field-row">
        <label>
          Identity
          <select
            value={identity}
            onChange={(e) => dispatch(identityChanged(e.target.value))}
          >
            {identities.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>

        <label>
          Action
          <select value={actionName} onChange={(e) => setActionName(e.target.value)}>
            {ACTION_DEFS.map((def) => (
              <option key={def.action} value={def.action}>
                {def.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {roles && (
        <p className="scope-hint">
          <code>{identity}</code> is scoped to:{" "}
          {roles[identity]?.length ? roles[identity].join(", ") : "(no permissions)"}
        </p>
      )}

      <div className="field-row">
        {actionDef.fields.map((field) => (
          <label key={field.name}>
            <span>
              {field.label}
              <span className="required-marker" aria-hidden="true">
                {" "}
                *
              </span>
            </span>
            <input
              required
              value={fieldValues[field.name] ?? ""}
              placeholder={field.placeholder}
              onChange={(e) =>
                setFieldValues((prev) => ({ ...prev, [field.name]: e.target.value }))
              }
            />
          </label>
        ))}
      </div>

      <div className="console-status">
        {mintState.isLoading && <span className="dim">minting session token…</span>}
        {token && !mintState.isLoading && (
          <span className="dim">
            session token ready · {token.slice(0, 18)}…{token.slice(-6)}
          </span>
        )}
      </div>

      <button
        className="attempt-button"
        onClick={handleAttempt}
        disabled={!canAttempt || attemptState.isLoading}
      >
        {attemptState.isLoading
          ? "Attempting…"
          : cooldown > 0
            ? `Retry in ${cooldown}s`
            : `Attempt ${actionDef.label}`}
      </button>

      {missingFields.length > 0 && (
        <p className="field-hint">Fill in the required fields to continue.</p>
      )}
      {attemptError && <p className="attempt-error">{attemptError}</p>}

      {result && kind && (
        <div className={`result-ribbon ${RIBBON[kind].className}`}>
          <span className="ribbon-tag">{RIBBON[kind].tag}</span>
          <span className="result-status">{result.status}</span>
          {kind === "rate_limited" && (
            <p className="result-note">
              The gateway is limiting this identity, not the policy layer: the permission check
              never ran.
              {result.retryAfterSeconds !== undefined &&
                ` Retry-After: ${result.retryAfterSeconds}s.`}
            </p>
          )}
          {kind === "unavailable" && (
            <p className="result-note">
              The gateway shed this request or its circuit breaker is open: the permission check
              never ran.
              {result.retryAfterSeconds !== undefined &&
                ` Retry-After: ${result.retryAfterSeconds}s.`}
            </p>
          )}
          <pre className="result-body">{JSON.stringify(result.body, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
