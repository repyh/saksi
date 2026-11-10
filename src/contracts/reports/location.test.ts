import { test, expect } from "bun:test";
import { isPointNearRoad, pointInGeometry, roadDistanceMeters } from "./location";

const kotak = {
  type: "Polygon" as const,
  coordinates: [[
    [106.6, -6.2],
    [106.7, -6.2],
    [106.7, -6.1],
    [106.6, -6.1],
    [106.6, -6.2],
  ]],
};

test("pointInGeometry: di dalam, di luar, dan lubang", () => {
  expect(pointInGeometry({ longitude: 106.65, latitude: -6.15 }, kotak)).toBe(true);
  expect(pointInGeometry({ longitude: 106.5, latitude: -6.15 }, kotak)).toBe(false);
  const berlubang = {
    type: "Polygon" as const,
    coordinates: [
      kotak.coordinates[0],
      [[106.64, -6.16], [106.66, -6.16], [106.66, -6.14], [106.64, -6.14], [106.64, -6.16]],
    ],
  };
  expect(pointInGeometry({ longitude: 106.65, latitude: -6.15 }, berlubang)).toBe(false);
});

test("roadDistanceMeters dan isPointNearRoad memakai ambang meter", () => {
  const garis = {
    type: "LineString" as const,
    coordinates: [[106.65, -6.16], [106.65, -6.14]],
  };
  const dekat = { longitude: 106.6502, latitude: -6.15 };
  const jauh = { longitude: 106.66, latitude: -6.15 };
  expect(roadDistanceMeters(dekat, garis)).toBeLessThan(30);
  expect(isPointNearRoad(dekat, garis, 60)).toBe(true);
  expect(roadDistanceMeters(jauh, garis)).toBeGreaterThan(500);
  expect(isPointNearRoad(jauh, garis, 60)).toBe(false);
});

test("isPointNearRoad tanpa geometri tidak memblokir", () => {
  expect(isPointNearRoad({ longitude: 106.65, latitude: -6.15 }, null)).toBe(true);
});
