import { expect, test, type Locator } from "@playwright/test";
import {
  attachPhoto,
  goToDamageStep,
  goToLocationStep,
  mockReportFailure,
  mockReportSubmit,
  openReport,
  selectFirstArea,
} from "./helpers";

test.describe("alur laporan warga", () => {
  test("alasan aksi terlihat dan tombol memberi umpan balik", async ({ page }) => {
    await openReport(page);
    await expect(page.locator("#report-photo-camera")).toHaveCount(1);
    await expect(page.locator("#report-photo-gallery")).toHaveCount(1);
    await expect(page.locator("aside").getByText("Belum dipilih")).toHaveCount(3);
    await expect(page.locator("aside").getByText("—")).toHaveCount(5);
    await expect(page.getByText("Pilih foto dulu")).toBeVisible();
    const advance = page.getByRole("button", { name: /^Lanjut/ });
    await expect(advance).toBeEnabled();
    await advance.click();
    await expect(page.locator('p[role="alert"]', { hasText: "Pilih foto dulu" })).toBeVisible();
    await attachPhoto(page);
    await expect(page.getByText("Pilih foto dulu")).toHaveCount(0);
  });

  test("perpindahan langkah memindahkan fokus dan mengumumkan progres", async ({ page }) => {
    await openReport(page);
    await attachPhoto(page);
    await page.getByRole("button", { name: /^Lanjut/ }).click();
    await expect(page.getByRole("heading", { name: "Jenis kerusakan" })).toBeFocused();
    await expect(page.locator('span[aria-live="polite"]')).toContainText("Langkah 2 dari 4");
    await page.getByRole("button", { name: "Kembali" }).click();
    await expect(page.getByRole("heading", { name: "Foto kerusakan" })).toBeFocused();
    await expect(page.locator('span[aria-live="polite"]')).toContainText("Langkah 1 dari 4");
  });

  test("draf dipulihkan setelah halaman disegarkan", async ({ page }) => {
    await goToDamageStep(page);
    await page.getByRole("radio", { name: /Lubang/ }).click();
    await page.locator("#report-description").fill("Kerusakan dekat persimpangan untuk uji draf.");
    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.getByText("Draf tersimpan di perangkat ini")).toBeVisible();
    await page.getByRole("button", { name: "Lanjutkan draf" }).click();
    await expect(page.getByRole("heading", { name: "Jenis kerusakan" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Lubang/ })).toBeChecked();
    await expect(page.locator("#report-description")).toHaveValue(/uji draf/);
    await expect(page.getByText("1 foto siap")).toBeVisible();
    await page.getByRole("button", { name: "Kembali" }).click();
    await expect(page.getByAltText("Pratinjau foto kerusakan yang dipilih")).toBeVisible();
  });

  test("pemilih wilayah bertingkat kecamatan, kelurahan, dan RW", async ({ page }) => {
    await goToLocationStep(page);
    await page.getByRole("button", { name: "Wilayah saja" }).click();
    await expect(page.locator("#report-district")).toBeVisible();
    await expect(page.locator("#report-village")).toBeDisabled();
    await expect(page.locator("#report-rw")).toBeDisabled();
    const { rwValue } = await selectFirstArea(page);
    await expect(page.locator("#report-rw")).toHaveValue(rwValue);
    await expect(page.getByText(/Wilayah laporan: .*RW/)).toBeVisible();
    await expect(page.locator("#report-area")).toHaveCount(0);
  });

  test("titik hanya berpindah lewat mode tandai dan kamera tidak melompat", async ({ page }) => {
    await goToLocationStep(page);
    const map = page.locator('[data-map-loaded="true"]');
    await expect(map).toBeVisible({ timeout: 30_000 });
    const canvas = page.locator('[aria-label="Peta lokasi laporan"] canvas').first();
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(400);
    await expect(page.getByRole("button", { name: "Hapus titik" })).toHaveCount(0);

    await page.getByRole("button", { name: "Tandai titik" }).click();
    await expect(page.locator('[data-map-marking="true"]')).toBeVisible();
    await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.55);
    await expect(page.getByRole("button", { name: "Hapus titik" })).toBeVisible();
    const marker = page.locator(".maplibregl-marker");
    await expect(marker).toBeVisible();
    await page.waitForTimeout(800);
    const before = await markerPosition(page);

    await page.locator("#report-landmark").fill("Jl. Uji Kamera Stabil");
    await page.waitForTimeout(700);
    const after = await markerPosition(page);
    expect(Math.abs(before.x - after.x)).toBeLessThanOrEqual(3);
    expect(Math.abs(before.y - after.y)).toBeLessThanOrEqual(3);

    await page.getByRole("button", { name: "Selesai menandai" }).click();
    const boxAfter = await canvas.boundingBox();
    if (!boxAfter) throw new Error("Peta tidak memiliki ukuran.");
    await page.mouse.click(boxAfter.x + boxAfter.width * 0.65, boxAfter.y + boxAfter.height * 0.45);
    await page.waitForTimeout(400);
    const stillThere = await markerPosition(page);
    expect(Math.abs(after.x - stillThere.x)).toBeLessThanOrEqual(3);
    expect(Math.abs(after.y - stillThere.y)).toBeLessThanOrEqual(3);
    await expect(page.getByRole("button", { name: "Hapus titik" })).toBeVisible();
  });

  test("satu model lokasi aktif dan perpindahan meminta konfirmasi", async ({ page }) => {
    await goToLocationStep(page);
    await page.locator('[data-map-loaded="true"]').waitFor({ state: "attached", timeout: 30_000 });
    const canvas = page.locator('[aria-label="Peta lokasi laporan"] canvas').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Peta tidak memiliki ukuran.");
    await page.getByRole("button", { name: "Tandai titik" }).click();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByRole("button", { name: "Hapus titik" })).toBeVisible();

    await page.getByRole("button", { name: "Wilayah saja" }).click();
    await expect(page.locator('main [role="alert"]', { hasText: "menghapus titik presisi" })).toBeVisible();
    await page.getByRole("button", { name: "Batal" }).click();
    await expect(page.getByRole("button", { name: "Hapus titik" })).toBeVisible();

    await page.getByRole("button", { name: "Wilayah saja" }).click();
    await page.getByRole("button", { name: "Ya, hapus titik" }).click();
    await expect(page.locator("#report-district")).toBeVisible();
    await expect(page.getByRole("button", { name: "Hapus titik" })).toHaveCount(0);
  });

  test("consent titik tampil publik dikonfirmasi sebelum kirim", async ({ page }) => {
    await goToLocationStep(page);
    const map = page.locator('[data-map-loaded="true"]');
    await expect(map).toBeVisible({ timeout: 30_000 });
    const canvas = page.locator('[aria-label="Peta lokasi laporan"] canvas').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Peta tidak memiliki ukuran.");
    await page.getByRole("button", { name: "Tandai titik" }).click();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    const consent = page.getByRole("checkbox", { name: /Tampilkan titik ini/ });
    await expect(consent).toBeChecked();
    await expect(page.getByText("Titik presisi akan tampil di halaman publik.", { exact: true })).toBeVisible();
    await consent.uncheck();
    await expect(page.getByText("Titik presisi tidak akan tampil di halaman publik.", { exact: true })).toBeVisible();
  });

  test("kandidat paket dibatasi lima dan kartu dapat ditautkan", async ({ page }) => {
    await goToLocationStep(page);
    await page.getByRole("button", { name: "Wilayah saja" }).click();
    const districtSelect = page.locator("#report-district");
    const districts = await districtSelect.locator("option").evaluateAll((options) => options
      .map((option) => (option as HTMLOptionElement).value)
      .filter(Boolean));
    let chosen = "";
    for (const district of districts) {
      const response = await page.request.get(`/api/packages?district=${encodeURIComponent(district)}&limit=5`);
      if (!response.ok()) continue;
      const payload = await response.json() as { data?: { items?: unknown[] } };
      if ((payload.data?.items ?? []).length > 0) {
        chosen = district;
        break;
      }
    }
    expect(chosen, "tidak ada kecamatan dengan paket pada snapshot").not.toBe("");
    await districtSelect.selectOption(chosen);
    await page.locator("#report-village").selectOption(await firstOption(page.locator("#report-village")));
    await page.locator("#report-rw").selectOption(await firstOption(page.locator("#report-rw")));

    await page.locator("summary", { hasText: "Paket rujukan" }).click();
    await expect(page.getByRole("heading", { name: "Paket yang mungkin terkait" })).toBeVisible();
    const details = page.locator("details", { hasText: "Paket rujukan" });
    const cards = details.locator("ul > li");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeLessThanOrEqual(5);
    const seeAll = page.getByRole("button", { name: /Lihat semua/ });
    if (await seeAll.isVisible()) {
      await seeAll.click();
      expect(await cards.count()).toBeGreaterThan(5);
    }

    await cards.first().getByRole("button").first().click();
    const unlink = page.getByRole("button", { name: "Batalkan tautan" });
    await expect(unlink).toBeVisible();
    await unlink.click();
    await expect(page.getByRole("button", { name: "Batalkan tautan" })).toHaveCount(0);
  });

  test("pasca-kirim: tanda terima disalin, disimpan, dan draf dihapus", async ({ page }) => {
    await goToLocationStep(page);
    await selectFirstArea(page);
    await mockReportSubmit(page, "LPR-UJI-001");
    await page.getByRole("button", { name: "Kirim laporan" }).click();
    await expect(page.getByRole("heading", { name: "Laporan berhasil dikirim" })).toBeVisible();
    await expect(page.getByText("LPR-UJI-001")).toBeVisible();
    await expect(page.getByText(/Titik presisi tidak ditampilkan|Titik presisi tampil/)).toBeVisible();
    await page.getByRole("button", { name: "Salin nomor" }).click();
    await expect(page.getByRole("button", { name: "Tersalin" })).toBeVisible();

    await openReport(page);
    await expect(page.getByText("Tanda terima terakhir tersimpan di perangkat ini")).toBeVisible();
    await expect(page.getByText("LPR-UJI-001")).toBeVisible();
    await expect(page.getByText("Draf tersimpan di perangkat ini")).toHaveCount(0);
  });

  test("galat layanan dipetakan ke tindakan berikutnya", async ({ page }) => {
    await goToLocationStep(page);
    await selectFirstArea(page);
    await mockReportFailure(page, 503, "REPORTS_UNAVAILABLE", "Pengiriman laporan belum dikonfigurasi.");
    await page.getByRole("button", { name: "Kirim laporan" }).click();
    await expect(page.getByText("Layanan laporan sedang tidak tersedia. Coba lagi nanti atau kirim melalui kanal resmi.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Lokasi dan paket terkait" })).toBeVisible();
  });
});

async function markerPosition(page: import("@playwright/test").Page) {
  const marker = await page.locator(".maplibregl-marker").boundingBox();
  const map = await page.locator('[aria-label="Peta lokasi laporan"]').boundingBox();
  if (!marker || !map) throw new Error("Posisi penanda atau peta tidak terbaca.");
  return { x: marker.x - map.x, y: marker.y - map.y };
}

async function firstOption(select: Locator) {
  const value = await select.locator("option").nth(1).getAttribute("value");
  if (!value) throw new Error("Pilihan wilayah tidak tersedia pada data batas.");
  return value;
}
