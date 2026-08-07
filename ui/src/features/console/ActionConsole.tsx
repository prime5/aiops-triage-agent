import { useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { ACTION_DEFS } from "../../api/actions";
import { useAttemptActionMutation, useGetRolesQuery, useMintSessionMutation } from "../../api/triageApi";
import type { AttemptResult } from "../../api/types";
import { identityChanged, tokenMinted } from "../session/sessionSlice";

export function ActionConsole() {
  const dispatch = useAppDispatch();
  const { identity, token } = useAppSelector((state) => state.session);
  const { data: roles } = useGetRolesQuery();
  const [mintSession, mintState] = useMintSessionMutation();
  const [attemptAction, attemptState] = useAttemptActionMutation();

  const [actionName, setActionName] = useState(ACTION_DEFS[0].action);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);

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
    setFieldValues({});
    setResult(null);
  }, [actionName]);

  const handleAttempt = async () => {
    if (!token) return;
    const res = await attemptAction({ def: actionDef, values: fieldValues, token }).unwrap();
    setResult(res);
  };

  const canAttempt = Boolean(token) && actionDef.fields.every((f) => fieldValues[f.name]?.trim());

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
            {field.label}
            <input
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
        {attemptState.isLoading ? "Attempting…" : `Attempt ${actionDef.label}`}
      </button>

      {result && (
        <div className={`result-ribbon ${result.status < 400 ? "result-allow" : "result-deny"}`}>
          <span className="ribbon-tag">{result.status < 400 ? "ALLOWED" : "DENIED"}</span>
          <span className="result-status">{result.status}</span>
          <pre className="result-body">{JSON.stringify(result.body, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
