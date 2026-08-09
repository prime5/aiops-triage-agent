// Frontend-only manifest mapping each policy action to the real backend
// endpoint that performs it. Kept separate from the roles data (which only
// says who is *allowed* to do what) so the console can deliberately let a
// user pair any identity with any action, including mismatched ones.
export interface ActionField {
  name: string;
  label: string;
  placeholder: string;
}

export interface ActionDef {
  action: string;
  label: string;
  method: "GET" | "POST";
  fields: ActionField[];
  pathParams: string[];
  queryParams: string[];
  buildPath: (values: Record<string, string>) => string;
}

export const ACTION_DEFS: ActionDef[] = [
  {
    action: "read_alert",
    label: "Read alert",
    method: "GET",
    fields: [{ name: "alert_id", label: "Alert ID", placeholder: "e.g. 42" }],
    pathParams: ["alert_id"],
    queryParams: [],
    buildPath: (v) => `/alerts/${encodeURIComponent(v.alert_id ?? "")}`,
  },
  {
    action: "read_runbook",
    label: "Read runbook",
    method: "GET",
    fields: [{ name: "runbook_id", label: "Runbook ID", placeholder: "e.g. restart-service" }],
    pathParams: ["runbook_id"],
    queryParams: [],
    buildPath: (v) => `/runbooks/${encodeURIComponent(v.runbook_id ?? "")}`,
  },
  {
    action: "post_slack_message",
    label: "Post Slack message",
    method: "POST",
    fields: [
      { name: "channel", label: "Channel", placeholder: "e.g. #incidents" },
      { name: "text", label: "Message", placeholder: "e.g. Investigating alert 42" },
    ],
    pathParams: [],
    queryParams: ["channel", "text"],
    buildPath: () => `/slack/message`,
  },
  {
    action: "trigger_runbook",
    label: "Trigger runbook",
    method: "POST",
    fields: [{ name: "runbook_id", label: "Runbook ID", placeholder: "e.g. restart-service" }],
    pathParams: ["runbook_id"],
    queryParams: [],
    buildPath: (v) => `/runbooks/${encodeURIComponent(v.runbook_id ?? "")}/trigger`,
  },
  {
    action: "escalate_pagerduty",
    label: "Escalate to PagerDuty",
    method: "POST",
    fields: [{ name: "incident_id", label: "Incident ID", placeholder: "e.g. INC-1234" }],
    pathParams: [],
    queryParams: ["incident_id"],
    buildPath: () => `/pagerduty/escalate`,
  },
];
