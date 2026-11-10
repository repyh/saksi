import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { attachPhoto, mockReportSubmit, openReport, selectFirstArea } from "./helpers";

const DIR = path.join(process.cwd(), "docs", "assets", "verifikasi");

test.describe("tangkapan layar verifikasi", () => {
  test("langkah 1 dan 3 pada 320, 390, 768, dan 1440 px", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "cukup satu proyek untuk tangkapan layar");
    test.setTimeout(300_000);
    fs.mkdirSync(DIR, { recursive: true });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await openReport(page);
      await attachPhoto(page);
      await stabilizeForScreenshot(page);
      await page.screenshot({ path: path.join(DIR, `alur-langkah-1-${width}.png`), fullPage: true });

      await page.getByRole("button", { name: /^Lanjut/ }).click();
      await page.getByRole("radio", { name: /Lubang/ }).click();
      await page.getByRole("button", { name: /^Lanjut/ }).click();
      await expect(page.getByRole("heading", { name: "Lokasi dan paket terkait" })).toBeVisible();
      await selectFirstArea(page);
      await stabilizeForScreenshot(page);
      await page.screenshot({ path: path.join(DIR, `alur-langkah-3-${width}.png`), fullPage: true });
    }
  });

  test("layar sukses pada 390 dan 1440 px", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "cukup satu proyek untuk tangkapan layar");
    test.setTimeout(300_000);
    fs.mkdirSync(DIR, { recursive: true });
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await openReport(page);
      await attachPhoto(page);
      await page.getByRole("button", { name: /^Lanjut/ }).click();
      await page.getByRole("radio", { name: /Lubang/ }).click();
      await page.getByRole("button", { name: /^Lanjut/ }).click();
      await selectFirstArea(page);
      await page.unrouteAll();
      await mockReportSubmit(page, `LPR-${width}`);
      await page.getByRole("button", { name: "Kirim laporan" }).click();
      await expect(page.getByRole("heading", { name: "Laporan berhasil dikirim" })).toBeVisible();
      await stabilizeForScreenshot(page);
      await page.screenshot({ path: path.join(DIR, `alur-sukses-${width}.png`), fullPage: true });
    }
  });
});

async function stabilizeForScreenshot(page: import("@playwright/test").Page) {
  await page.addStyleTag({
    content: "header{position:static !important} [class*='sticky']{position:static !important}",
  });
  await page.evaluate(() => window.scrollTo(0, 0));
}
