import { expect, test } from "@playwright/test";
import { ADMIN, E2E_ADMIN_PHONE, sendOtpViaUi } from "../helpers";

test.describe("admin smokes", () => {
  test("staff OTP login and confirm an order status", async ({ page }) => {
    await page.goto(`${ADMIN}/login`);

    await page.getByPlaceholder("9876543210").fill(E2E_ADMIN_PHONE);
    const otp = await sendOtpViaUi(page);

    await page.getByPlaceholder("6-digit code").fill(otp);

    const verifyResponse = page.waitForResponse(
      (r) => r.url().includes("/api/auth/verify-otp") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: /Verify & sign in/i }).click();
    const verifyRes = await verifyResponse;
    expect(verifyRes.ok(), await verifyRes.text()).toBeTruthy();

    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });

    await page.goto(`${ADMIN}/orders`);
    await expect(page.getByText(/orders|pending|board|Deliver/i).first()).toBeVisible({
      timeout: 20_000,
    });

    const orderLink = page.locator('a[href*="/orders/"]').first();
    if (await orderLink.count()) {
      await orderLink.click();
      const statusSelect = page.locator("select").filter({ hasText: /Set to/i }).first();
      await expect(statusSelect).toBeVisible({ timeout: 15_000 });
      await statusSelect.selectOption({ label: "Set to confirmed" });
      await expect(page.getByText(/confirmed/i).first()).toBeVisible({ timeout: 15_000 });
    }
  });
});
