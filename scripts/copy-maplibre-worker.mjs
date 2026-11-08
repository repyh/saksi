import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs");
const target = resolve(root, "public/vendor/maplibre-gl-worker.mjs");

await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
