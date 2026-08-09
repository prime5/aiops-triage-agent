import { expect, test } from "@playwright/test";

test.describe("Action console — allow/deny ribbon (TC-28, TC-29)", () => {
  test("TC-28: an allowed action shows a green ALLOWED ribbon with status + body", async ({
    page,
  }) => {
    await page.goto("/");
    const console_ = page.locator(".panel", {
      has: page.getByRole("heading", { name: "Try an action" }),
    });

    // Deliberately pick a non-default identity/action pair so this doesn't
    // silently pass just because it matches the console's initial state.
    await console_.getByLabel("Identity").selectOption({ label: "triage-agent-remediator" });
    await console_.getByLabel("Action").selectOption({ label: "Escalate to PagerDuty" });
    await console_.getByLabel("Incident ID").fill("INC-1234");

    const attemptButton = console_.getByRole("button", { name: /Attempt/ });
    await expect(attemptButton).toBeEnabled();
    await attemptButton.click();

    const ribbon = console_.locator(".result-ribbon");
    await expect(ribbon).toBeVisible();
    await expect(ribbon).toHaveClass(/result-allow/);
    await expect(ribbon.locator(".ribbon-tag")).toHaveText("ALLOWED");
    await expect(ribbon.locator(".result-status")).toHaveText("200");
    await expect(ribbon.locator(".result-body")).toContainText('"incident_id": "INC-1234"');
  });

  test("TC-29: the overreach case shows a red DENIED ribbon with the 403 body", async ({
    page,
  }) => {
    await page.goto("/");
    const console_ = page.locator(".panel", {
      has: page.getByRole("heading", { name: "Try an action" }),
    });

    // Identity is already "triage-agent-readonly" by default — only the
    // action needs to change, to the overreach demo (trigger_runbook).
    await console_.getByLabel("Action").selectOption({ label: "Trigger runbook" });
    await console_.getByLabel("Runbook ID").fill("restart-service");

    const attemptButton = console_.getByRole("button", { name: /Attempt/ });
    await expect(attemptButton).toBeEnabled();
    await attemptButton.click();

    const ribbon = console_.locator(".result-ribbon");
    await expect(ribbon).toBeVisible();
    await expect(ribbon).toHaveClass(/result-deny/);
    await expect(ribbon.locator(".ribbon-tag")).toHaveText("DENIED");
    await expect(ribbon.locator(".result-status")).toHaveText("403");
  });

  test("TC-25 regression: reselecting the already-active identity must not strand the token", async ({
    page,
  }) => {
    await page.goto("/");
    const console_ = page.locator(".panel", {
      has: page.getByRole("heading", { name: "Try an action" }),
    });

    // The console defaults to triage-agent-readonly. Explicitly reselecting
    // that same value (no actual change) still dispatches identityChanged —
    // guards against the reducer wiping the token on a same-value dispatch
    // when the mint effect (keyed on the identity value) has nothing to
    // react to and never re-mints.
    await console_.getByLabel("Identity").selectOption({ label: "triage-agent-readonly" });
    await console_.getByLabel("Alert ID").fill("42");

    const attemptButton = console_.getByRole("button", { name: /Attempt/ });
    await expect(attemptButton).toBeEnabled();
  });
});

test.describe("Action console — required-field indicator (TC-27)", () => {
  test("empty required field is visibly marked and the button explains why it's disabled", async ({
    page,
  }) => {
    await page.goto("/");
    const console_ = page.locator(".panel", {
      has: page.getByRole("heading", { name: "Try an action" }),
    });

    // wait for the session token to mint so the button is only blocked on the field, not auth
    await expect(console_.locator(".console-status")).toContainText("session token ready");

    const field = console_.getByLabel("Alert ID");
    await expect(field).toHaveAttribute("required", "");
    // placeholder must read as an example, not a real value, to avoid the
    // "the field already has 42 in it" confusion
    await expect(field).toHaveAttribute("placeholder", /^e\.g\./);

    const label = console_.locator("label", { hasText: "Alert ID" });
    await expect(label.locator(".required-marker")).toBeVisible();

    const attemptButton = console_.getByRole("button", { name: /Attempt/ });
    await expect(attemptButton).toBeDisabled();
    await expect(console_.locator(".field-hint")).toHaveText(/fill in the required field/i);

    await field.fill("42");
    await expect(attemptButton).toBeEnabled();
    await expect(console_.locator(".field-hint")).toHaveCount(0);
  });
});

test.describe("Action console — network failure resilience (TC-39)", () => {
  test("a failed action request shows a visible error instead of failing silently", async ({
    page,
  }) => {
    await page.goto("/");
    const console_ = page.locator(".panel", {
      has: page.getByRole("heading", { name: "Try an action" }),
    });

    // let auth/session and policy/roles succeed as normal, then simulate the
    // backend going unreachable for just the action call itself
    await expect(console_.locator(".console-status")).toContainText("session token ready");
    await page.route("**/alerts/**", (route) => route.abort("failed"));

    await console_.getByLabel("Alert ID").fill("42");
    const attemptButton = console_.getByRole("button", { name: /Attempt/ });
    await attemptButton.click();

    // the console must still be there — no crash/blank screen
    await expect(page.getByRole("heading", { name: "Try an action" })).toBeVisible();

    // and it must not fail silently: a visible error explains what happened
    await expect(console_.locator(".attempt-error")).toBeVisible();
    await expect(console_.locator(".attempt-error")).toContainText(/couldn.?t reach the server/i);

    // the button must recover — not get stuck disabled or on "Attempting…"
    await expect(attemptButton).toBeEnabled();
    await expect(attemptButton).toHaveText("Attempt Read alert");
  });
});
