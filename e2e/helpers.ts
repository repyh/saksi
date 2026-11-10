import { expect, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";

let testPhoto: Buffer | null = null;

/** PNG 64×64 yang dapat didekode Chromium, dibuat dengan sharp. */
async function buildTestPhoto() {
  if (!testPhoto) {
    testPhoto = await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 120, g: 140, b: 160 } },
    }).png().toBuffer();
  }
  return testPhoto;
}

export async function openHome(page: Page) {
  await page.goto("/");
  await page.locator('nav[data-nav-ready="true"]').waitFor({ state: "attached" });
}

export async function openReport(page: Page) {
  await page.goto("/laporan");
  await page.locator('main[data-report-ready="true"]').waitFor();
}

export async function attachPhoto(page: Page) {
  await page.locator("#report-photo-gallery").setInputFiles({
    name: "foto-uji.png",
    mimeType: "image/png",
    buffer: await buildTestPhoto(),
  });
  await expect(page.getByAltText("Pratinjau foto kerusakan yang dipilih")).toBeVisible();
}

export async function goToDamageStep(page: Page) {
  await openReport(page);
  await attachPhoto(page);
  await page.getByRole("button", { name: /^Lanjut/ }).click();
  await expect(page.getByRole("heading", { name: "Jenis kerusakan" })).toBeVisible();
}

export async function goToLocationStep(page: Page) {
  await goToDamageStep(page);
  await page.getByRole("radio", { name: /Lubang/ }).click();
  await page.getByRole("button", { name: /^Lanjut/ }).click();
  await expect(page.getByRole("heading", { name: "Lokasi dan paket terkait" })).toBeVisible();
}

export async function selectFirstArea(page: Page) {
  await page.getByRole("button", { name: "Wilayah saja" }).click();
  const district = page.locator("#report-district");
  await expect(district).toBeVisible();
  const districtValue = await firstOptionValue(district);
  await district.selectOption(districtValue);
  const village = page.locator("#report-village");
  const villageValue = await firstOptionValue(village);
  await village.selectOption(villageValue);
  const rw = page.locator("#report-rw");
  const rwValue = await firstOptionValue(rw);
  await rw.selectOption(rwValue);
  await expect(page.getByText(/Wilayah laporan:/)).toBeVisible();
  return { districtValue, villageValue, rwValue };
}

async function firstOptionValue(select: Locator) {
  const value = await select.locator("option").nth(1).getAttribute("value");
  if (!value) throw new Error("Pilihan wilayah tidak tersedia pada data batas.");
  return value;
}

export async function mockReportSubmit(page: Page, code = "LPR-UJI-001") {
  await page.route("**/api/reports", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { code, status: "SUBMITTED" }, error: null }),
    });
  });
}

export async function mockReportFailure(page: Page, status: number, code: string, message: string) {
  await page.route("**/api/reports", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({ data: null, error: { code, message } }),
    });
  });
}
