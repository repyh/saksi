import { expect, test } from "@playwright/test";
import { openHome } from "./helpers";

test.describe("navigasi dan titik masuk", () => {
  test("tidak ada gulir horizontal pada 320 px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    for (const path of ["/", "/laporan", "/peta-pekerjaan"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `overflow horizontal di ${path}`).toBeLessThanOrEqual(1);
    }
  });

  test("menu ringkas ponsel memuat semua tujuan", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390", "menu ringkas hanya untuk ponsel");
    await openHome(page);
    await expect(page.getByRole("link", { name: "Laporkan", exact: true })).toBeVisible();
    const toggle = page.getByRole("button", { name: "Buka menu navigasi" });
    await expect(toggle).toBeVisible();
    await toggle.click();
    const panel = page.getByRole("navigation", { name: "Navigasi utama ponsel" });
    await expect(panel).toBeVisible();
    for (const label of ["Home", "Peta Pekerjaan", "Paket Jalan", "Penyedia", "Metode"]) {
      await expect(panel.getByRole("link", { name: label })).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(toggle).toBeFocused();
  });

  test("navigasi desktop menampilkan Laporkan Jalan", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "navigasi penuh hanya untuk desktop");
    await openHome(page);
    await expect(page.getByRole("button", { name: "Laporkan Jalan" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Buka menu navigasi" })).toBeHidden();
  });

  test("beranda punya CTA laporan setelah perjalanan paket", async ({ page }) => {
    await openHome(page);
    const cta = page.getByRole("link", { name: "Laporkan kerusakan jalan" });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/laporan/);
    await expect(page.getByRole("heading", { name: "Laporkan kerusakan jalan" })).toBeVisible();
  });

  test("kepala alur laporan tidak menduplikasi navigasi", async ({ page }) => {
    await page.goto("/laporan");
    await expect(page.getByRole("heading", { name: "Laporkan kerusakan jalan" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Lihat laporan publik" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Kembali ke peta" })).toHaveCount(0);
  });

  test("halaman offline berbahasa Indonesia dan menyebut draf", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: "Anda sedang offline" })).toBeVisible();
    await expect(page.getByText("Draf di perangkat tidak hilang; kirim setelah koneksi kembali.")).toBeVisible();
    await expect(page.getByText("You’re offline")).toHaveCount(0);
  });
});
