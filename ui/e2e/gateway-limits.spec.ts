import { expect, test, type Route } from "@playwright/test";

// The console must treat the flowgate gateway's 429 / 503 as "the protection
// layer pushed back", not as a permission denial. These tests stub the
// gateway's responses at the network layer so they are deterministic and do
// not depend on actually exhausting a rate limit. Only the action call is
// stubbed; the role list and token mint still hit the real backend.
//
// The stub adds CORS headers because the console (localhost:5173) and the
// backend (127.0.0.1:8000) are different origins. A real flowgate response
// has none, which is why the documented gateway setup uses the same-origin
// dev proxy (see the README).

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-expose-headers": "Retry-After",
};

function stubAlerts(status: number, retryAfter: string | undefined, body: string) {
  return async (route: Route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: cors });
    }
    return route.fulfill({
      status,
      headers: { ...cors, "content-type": "text/plain", ...(retryAfter ? { "retry-after": retryAfter } : {}) },
      body,
    });
  };
}

async function openConsole(page: import("@playwright/test").Page) {
  await page.goto("/");
  const console_ = page.locator(".panel", {
    has: page.getByRole("heading", { name: "Try an action" }),
  });
  await console_.getByLabel("Alert ID").fill("42");
  return console_;
}

test.describe("Action console — gateway pushback (429 / 503)", () => {
  test("429 shows an amber RATE LIMITED ribbon and a Retry-After countdown", async ({ page }) => {
    await page.route("**/alerts/**", stubAlerts(429, "2", "rate limit exceeded"));
    const console_ = await openConsole(page);

    const button = console_.getByRole("button", { name: /Attempt|Retry in/ });
    await expect(button).toBeEnabled();
    await button.click();

    const ribbon = console_.locator(".result-ribbon");
    await expect(ribbon).toHaveClass(/result-limited/);
    await expect(ribbon.locator(".ribbon-tag")).toHaveText("RATE LIMITED");
    await expect(ribbon.locator(".result-status")).toHaveText("429");
    await expect(ribbon).not.toContainText("DENIED");
    await expect(ribbon.locator(".result-note")).toContainText("Retry-After: 2s");

    // The button is locked for the advertised wait, then comes back.
    const locked = console_.getByRole("button", { name: /Retry in \d+s/ });
    await expect(locked).toBeDisabled();
    await expect(console_.getByRole("button", { name: /Attempt Read alert/ })).toBeEnabled({
      timeout: 6000,
    });
  });

  test("503 shows GATEWAY UNAVAILABLE, not a permission denial", async ({ page }) => {
    await page.route("**/alerts/**", stubAlerts(503, "1", "backend unavailable"));
    const console_ = await openConsole(page);

    await console_.getByRole("button", { name: /Attempt/ }).click();

    const ribbon = console_.locator(".result-ribbon");
    await expect(ribbon).toHaveClass(/result-unavailable/);
    await expect(ribbon.locator(".ribbon-tag")).toHaveText("GATEWAY UNAVAILABLE");
    await expect(ribbon.locator(".result-status")).toHaveText("503");
    await expect(ribbon.locator(".result-note")).toContainText("permission check");
  });

  test("a 429 with no usable Retry-After does not lock the button", async ({ page }) => {
    await page.route("**/alerts/**", stubAlerts(429, "1s", "rate limit exceeded"));
    const console_ = await openConsole(page);

    await console_.getByRole("button", { name: /Attempt/ }).click();

    await expect(console_.locator(".result-ribbon")).toHaveClass(/result-limited/);
    await expect(console_.getByRole("button", { name: /Attempt Read alert/ })).toBeEnabled();
  });
});
