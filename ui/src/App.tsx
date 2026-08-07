import { ActionConsole } from "./features/console/ActionConsole";
import { AuditTable } from "./features/audit/AuditTable";

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="eyebrow">aiops-triage-agent</span>
        <h1>Access control console</h1>
        <p className="app-subhead">
          Identities carry scoped, short-lived tokens instead of standing credentials — every
          action is checked against policy and logged, allowed or not.
        </p>
      </header>

      <main className="app-grid">
        <ActionConsole />
        <AuditTable />
      </main>
    </div>
  );
}

export default App;
