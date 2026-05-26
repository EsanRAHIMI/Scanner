import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const svgPath = path.join(root, 'public', 'Brand_symbol_1.svg');
const outDir = path.join(root, 'public', 'icons');

const sizes = [192, 512];

const svg = await readFile(svgPath);
await mkdir(outDir, { recursive: true });

for (const size of sizes) {
  const out = path.join(outDir, `icon-${size}.png`);
  await sharp(svg, { density: 300 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .png()
    .toFile(out);
  console.log(`Wrote ${out}`);
}

// Apple touch icon
await sharp(svg, { density: 300 })
  .resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
  .png()
  .toFile(path.join(outDir, 'apple-touch-icon.png'));
console.log('Wrote apple-touch-icon.png');
