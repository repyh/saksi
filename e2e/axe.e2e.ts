import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { attachPhoto, goToLocationStep, mockReportSubmit, openReport, selectFirstArea } from "./helpers";

async function expectNoSeriousViolations(page: Page, state: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
  expect(
    blocking.map((violation) => `${violation.id} (${violation.impact}): ${violation.help}`),
    `pelanggaran axe serious/critical pada ${state}`,
  ).toEqual([]);
}

test.describe("axe alur laporan", () => {
  test("langkah 1 tidak punya pelanggaran serious/critical", async ({ page }) => {
    await openReport(page);
    await attachPhoto(page);
    await expectNoSeriousViolations(page, "langkah 1");
  });

  test("langkah 3 tidak punya pelanggaran serious/critical", async ({ page }) => {
    await goToLocationStep(page);
    await selectFirstArea(page);
    await expectNoSeriousViolations(page, "langkah 3");
  });

  test("layar sukses tidak punya pelanggaran serious/critical", async ({ page }) => {
    await goToLocationStep(page);
    await selectFirstArea(page);
    await mockReportSubmit(page, "LPR-AXE-001");
    await page.getByRole("button", { name: "Kirim laporan" }).click();
    await expect(page.getByRole("heading", { name: "Laporan berhasil dikirim" })).toBeVisible();
    await expectNoSeriousViolations(page, "layar sukses");
  });
});
