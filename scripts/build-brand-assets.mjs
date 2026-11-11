import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GEOMETRY = path.join(ROOT, "src/components/brand/mark-geometry.ts");
const OUT = path.join(ROOT, "public/brand");

const source = fs.readFileSync(GEOMETRY, "utf8");

function str(name) {
  const m = source.match(new RegExp(`export const ${name} =\\s*\\n?\\s*"([^"]+)"`));
  if (!m) throw new Error(`konstanta ${name} tidak ada di mark-geometry.ts`);
  return m[1];
}

function num(name) {
  const m = source.match(new RegExp(`export const ${name} = ([0-9.]+ / [0-9.]+);`));
  if (!m) throw new Error(`konstanta ${name} tidak ada di mark-geometry.ts`);
  return eval(m[1]);
}

const SOLID = str("EMBLEM_SOLID_PATH");
const FRAME = str("EMBLEM_FRAME_PATH");
const WORD = str("WORDMARK_PATH");
const EMBLEM_ASPECT = num("EMBLEM_ASPECT");
const WORD_ASPECT = num("WORDMARK_ASPECT");

const COBALT = "#0058A3";
const YELLOW = "#FFDA1A";
const NAVY = "#0A192F";
const WHITE = "#FFFFFF";

const fs_ = fs;

function emblem(x, y, h, fill, mono) {
  const body = mono
    ? `<path fill="${fill}" fill-rule="evenodd" d="${FRAME}"/><path fill="${fill}" fill-rule="evenodd" d="${SOLID}"/>`
    : `<path fill="${YELLOW}" fill-rule="evenodd" d="${FRAME}"/><path fill="${COBALT}" fill-rule="evenodd" d="${SOLID}"/>`;
  return `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${(h / 1000).toFixed(6)})">${body}</g>`;
}

function wordmark(x, y, cap, fill) {
  return `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${(cap / 100).toFixed(6)})"><path fill="${fill}" d="${WORD}"/></g>`;
}

function page(w, h, body, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w.toFixed(2)} ${h.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" role="img" aria-label="${label}">${body}</svg>`;
}

const H = 100;
const EMB_W = H * EMBLEM_ASPECT;
const CAP = 52;
const GAP = 50;
const WORD_W = CAP * WORD_ASPECT;

// emblem berdiri sendiri
fs_.writeFileSync(path.join(OUT, "saksi-emblem.svg"), page(EMB_W, H, emblem(0, 0, H, COBALT, false), "SAKSI"));
fs_.writeFileSync(
  path.join(OUT, "saksi-emblem-putih.svg"),
  page(EMB_W, H, emblem(0, 0, H, WHITE, true), "SAKSI")
);

// lockup horizontal
const hw = EMB_W + GAP + WORD_W;
fs_.writeFileSync(
  path.join(OUT, "saksi-logo-horizontal.svg"),
  page(hw, H, emblem(0, 0, H, COBALT, false) + wordmark(EMB_W + GAP, (H - CAP) / 2, CAP, COBALT), "SAKSI")
);
fs_.writeFileSync(
  path.join(OUT, "saksi-logo-horizontal-putih.svg"),
  page(hw, H, emblem(0, 0, H, WHITE, true) + wordmark(EMB_W + GAP, (H - CAP) / 2, CAP, WHITE), "SAKSI")
);

// lockup stacked
const sw = Math.max(EMB_W, WORD_W);
const sh = H + 30 + CAP;
fs_.writeFileSync(
  path.join(OUT, "saksi-logo-stacked.svg"),
  page(
    sw,
    sh,
    emblem((sw - EMB_W) / 2, 0, H, COBALT, false) + wordmark((sw - WORD_W) / 2, H + 30, CAP, COBALT),
    "SAKSI"
  )
);

// satu warna navy untuk cetak
fs_.writeFileSync(
  path.join(OUT, "saksi-mono.svg"),
  page(hw, H, emblem(0, 0, H, NAVY, true) + wordmark(EMB_W + GAP, (H - CAP) / 2, CAP, NAVY), "SAKSI")
);

console.log("ditulis:", fs_.readdirSync(OUT).sort().join(", "));
