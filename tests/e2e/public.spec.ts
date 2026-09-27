import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("home has direct reporting, lookup, and official contacts", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Report an issue →", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "860-757-9311" }).first(),
  ).toHaveAttribute("href", "tel:8607579311");
  await expect(
    page.getByText("Test reports only.", { exact: false }),
  ).toBeVisible();
});
test("manual reporting flow preserves draft across language changes", async ({
  page,
}) => {
  await page.goto("/report?service=pothole");
  await page
    .getByRole("textbox", { name: "Describe the issue *", exact: true })
    .fill("Synthetic test: a pothole at the intersection.");
  await page.getByRole("button", { name: "Continue →", exact: true }).click();
  await page
    .getByLabel("Street address or intersection *", { exact: true })
    .fill("Main Street & Gold Street, Hartford");
  await page.getByRole("button", { name: "Español", exact: true }).click();
  await expect(
    page.getByLabel("Dirección o intersección *", { exact: true }),
  ).toHaveValue("Main Street & Gold Street, Hartford");
  await page.getByRole("button", { name: "Continuar →", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Agregue fotos, si las tiene" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continuar →", exact: true }).click();
  await page
    .getByLabel("Nombre completo *", { exact: true })
    .fill("Residente de prueba");
  await page
    .getByLabel("Correo electrónico", { exact: true })
    .fill("test@example.invalid");
  await page.getByRole("button", { name: "Continuar →", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Revise su reporte de prueba" }),
  ).toBeVisible();
  await expect(
    page.getByText("Synthetic test: a pothole at the intersection.", {
      exact: false,
    }),
  ).toBeVisible();
});
test("invalid descriptions cannot advance", async ({ page }) => {
  await page.goto("/report");
  await page.getByRole("button", { name: "Continue →", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Choose a service" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "What needs attention?" }),
  ).toBeVisible();
});
test("service directory is searchable and bilingual", async ({ page }) => {
  await page.goto("/services");
  await expect(page.getByRole("status")).toHaveText("43 services");
  await page.getByLabel("Search services").fill("pothole");
  await expect(page.getByRole("status")).toHaveText("1 services");
  await page.getByRole("button", { name: "Español", exact: true }).click();
  await page.getByLabel("Buscar servicios").fill("bache");
  await expect(
    page.getByRole("heading", { name: "Bache, acera o bordillo dañado" }),
  ).toBeVisible();
});
test("public pages have no serious or critical automated accessibility violations", async ({
  page,
}) => {
  for (const path of [
    "/",
    "/services",
    "/report",
    "/status",
    "/contact",
    "/privacy",
    "/accessibility",
    "/admin",
  ]) {
    await page.goto(path);
    const report = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      report.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact || ""),
      ),
      path,
    ).toEqual([]);
  }
});
test("no horizontal page overflow on small screens", async ({ page }) => {
  for (const path of ["/", "/services", "/report", "/status", "/admin"]) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      path,
    ).toBe(true);
  }
});
