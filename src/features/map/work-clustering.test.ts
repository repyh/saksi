import { describe, expect, test } from "bun:test";
import { CLUSTER_RADIUS_PX, clusterWorkBadges, type WorkBadgePoint } from "./work-clustering";

function point(
  key: string,
  x: number,
  y: number,
  permukaan: number,
  drainase = 0,
  jembatan = 0,
): WorkBadgePoint {
  return {
    key,
    center: [106.6 + x * 0.001, -6.18 + y * 0.001],
    bounds: [
      [106.599 + x * 0.001, -6.181 + y * 0.001],
      [106.601 + x * 0.001, -6.179 + y * 0.001],
    ],
    workCounts: {
      PERMUKAAN: permukaan,
      DRAINASE: drainase,
      JEMBATAN: jembatan,
    },
    total: permukaan + drainase + jembatan,
    x,
    y,
  };
}

describe("clusterWorkBadges", () => {
  test("mengembalikan daftar kosong saat masukan kosong", () => {
    expect(clusterWorkBadges([])).toEqual([]);
  });

  test("menggabungkan titik berdekatan dengan jumlah paket, areaCount, dan bounds gabungan", () => {
    const a = point("kel-a", 100, 100, 10, 5, 0);
    const b = point("kel-b", 120, 110, 2, 3, 1);
    const result = clusterWorkBadges([a, b], 54);

    expect(result).toHaveLength(1);
    expect(result[0].areaCount).toBe(2);
    expect(result[0].total).toBe(21);
    expect(result[0].workCounts).toEqual({ PERMUKAAN: 12, DRAINASE: 8, JEMBATAN: 1 });
    expect(result[0].bounds[0][0]).toBeCloseTo(a.bounds![0][0], 6);
    expect(result[0].bounds[1][0]).toBeCloseTo(b.bounds![1][0], 6);
    expect(result[0].center[0]).toBeGreaterThan(a.center[0]);
    expect(result[0].center[0]).toBeLessThan(b.center[0]);
  });

  test("membiarkan titik berjauhan tetap terpisah sebagai area tunggal", () => {
    const result = clusterWorkBadges([point("a", 0, 0, 5), point("b", 120, 0, 3)], 54);

    expect(result).toHaveLength(2);
    expect(result.every((cluster) => cluster.areaCount === 1)).toBe(true);
  });

  test("putaran konvergensi menggabungkan klaster yang pusatnya saling mendekat di bawah radius", () => {
    // a (10) dan b (10) berjarak 45px sehingga pusat gabungannya bergeser ke x=22.5,
    // yang berjarak < 45px dari c (x=66) meskipun jarak awal a-c > 45px.
    const a = point("a", 0, 0, 10);
    const b = point("b", 44, 0, 10);
    const c = point("c", 66, 0, 2);

    const result = clusterWorkBadges([a, b, c], 45);
    expect(result).toHaveLength(1);
    expect(result[0].areaCount).toBe(3);
    expect(result[0].total).toBe(22);

    // Pastikan tidak ada pasangan klaster yang lebih dekat dari radius bawaan pada kumpulan titik acak.
    const dense = [
      point("1", 10, 10, 8),
      point("2", 50, 12, 7),
      point("3", 90, 14, 6),
      point("4", 130, 16, 5),
      point("5", 10, 60, 4),
    ];
    const clusters = clusterWorkBadges(dense, CLUSTER_RADIUS_PX);
    for (let i = 0; i < clusters.length; i += 1) {
      for (let j = i + 1; j < clusters.length; j += 1) {
        expect(Math.hypot(clusters[i].x - clusters[j].x, clusters[i].y - clusters[j].y)).toBeGreaterThanOrEqual(
          CLUSTER_RADIUS_PX,
        );
      }
    }
  });

  test("hasil klaster bersifat deterministik meski urutan masukan dibalik", () => {
    const items = [point("kel-c", 40, 20, 4), point("kel-a", 10, 10, 9), point("kel-b", 25, 15, 9)];
    const forward = clusterWorkBadges(items, 54);
    const reversed = clusterWorkBadges([...items].reverse(), 54);

    expect(reversed).toEqual(forward);
  });
});
