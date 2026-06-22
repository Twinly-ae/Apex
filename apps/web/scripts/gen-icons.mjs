// Rasterizes src/assets/logo.svg into the PWA PNG icons referenced by the
// manifest. Run once (or after changing the logo): `npm run gen:icons -w @apex/web`.
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const logo = resolve(root, "src/assets/logo.svg");
const outDir = resolve(root, "public/icons");

await mkdir(outDir, { recursive: true });

// "any" icons + apple-touch: the full logo.
for (const size of [192, 512]) {
  await sharp(logo).resize(size, size).png().toFile(resolve(outDir, `icon-${size}.png`));
}
await sharp(logo).resize(180, 180).png().toFile(resolve(outDir, "apple-touch-icon.png"));

// Maskable: peak at ~62% on a dark canvas so it survives platform masking.
const inner = Math.round(512 * 0.62);
const peak = await sharp(logo).resize(inner, inner).png().toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#0b0f14" },
})
  .composite([{ input: peak, gravity: "center" }])
  .png()
  .toFile(resolve(outDir, "maskable-512.png"));

console.log("✅ Icons written to", outDir);
