import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SOURCE_SVG_PATH = '/Users/PHUC/Desktop/logo.svg';
const PUBLIC_DIR = path.resolve('public');
const ICONS_DIR = path.resolve(PUBLIC_DIR, 'icons');

function createIco(pngBuffers) {
  const headerSize = 6;
  const dirEntrySize = 16;
  const count = pngBuffers.length;
  let offset = headerSize + count * dirEntrySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type icon
  header.writeUInt16LE(count, 4); // count

  const dirEntries = [];
  for (const item of pngBuffers) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(item.width === 256 ? 0 : item.width, 0);
    entry.writeUInt8(item.height === 256 ? 0 : item.height, 1);
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(item.buffer.length, 8); // size
    entry.writeUInt32LE(offset, 12); // offset
    dirEntries.push(entry);
    offset += item.buffer.length;
  }

  return Buffer.concat([header, ...dirEntries, ...pngBuffers.map(p => p.buffer)]);
}

async function main() {
  if (!fs.existsSync(SOURCE_SVG_PATH)) {
    throw new Error(`Source SVG not found at ${SOURCE_SVG_PATH}`);
  }

  const rawSvg = fs.readFileSync(SOURCE_SVG_PATH, 'utf8');
  // Normalize SVG: preserve aspect ratio cleanly, ensure standard SVG header
  const cleanSvg = rawSvg
    .replace('preserveAspectRatio="none"', 'preserveAspectRatio="xMidYMid meet"')
    .trim();

  fs.mkdirSync(ICONS_DIR, { recursive: true });

  // 1. Write vector SVG outputs
  const svgTargets = [
    path.join(ICONS_DIR, 'da-lieu-nhiet-doi-phu-quoc-logo.svg'),
    path.join(ICONS_DIR, 'logo.svg'),
    path.join(PUBLIC_DIR, 'favicon.svg'),
  ];
  for (const target of svgTargets) {
    fs.writeFileSync(target, cleanSvg, 'utf8');
    console.log(`✓ Wrote SVG: ${path.relative(process.cwd(), target)}`);
  }

  // 2. Render WebP logo
  const webpBuffer = await sharp(Buffer.from(cleanSvg), { density: 300 })
    .resize(512, 512)
    .webp({ quality: 95, effort: 6 })
    .toBuffer();
  fs.writeFileSync(path.join(ICONS_DIR, 'da-lieu-nhiet-doi-phu-quoc-logo.webp'), webpBuffer);
  fs.writeFileSync(path.join(ICONS_DIR, 'logo.webp'), webpBuffer);
  console.log(`✓ Wrote WebP: public/icons/da-lieu-nhiet-doi-phu-quoc-logo.webp (512x512)`);

  // 3. Render PNG sizes
  const sizes = [512, 192, 180, 96, 48, 32];
  const pngBySizes = new Map();

  for (const size of sizes) {
    const pngBuf = await sharp(Buffer.from(cleanSvg), { density: 300 })
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toBuffer();
    pngBySizes.set(size, pngBuf);

    // Primary brand filenames
    fs.writeFileSync(path.join(ICONS_DIR, `da-lieu-nhiet-doi-phu-quoc-${size}.png`), pngBuf);
    console.log(`✓ Wrote PNG: public/icons/da-lieu-nhiet-doi-phu-quoc-${size}.png`);

    // Aliases
    if (size === 180) {
      fs.writeFileSync(path.join(ICONS_DIR, 'apple-touch-icon.png'), pngBuf);
      fs.writeFileSync(path.join(ICONS_DIR, 'natural-skin-fern-180.png'), pngBuf);
    } else {
      fs.writeFileSync(path.join(ICONS_DIR, `icon-${size}.png`), pngBuf);
      fs.writeFileSync(path.join(ICONS_DIR, `natural-skin-fern-${size}.png`), pngBuf);
    }
  }

  // 4. Generate multi-resolution favicon.ico (16, 32, 48)
  const icoSizes = [16, 32, 48];
  const icoEntries = [];
  for (const s of icoSizes) {
    let buf = pngBySizes.get(s);
    if (!buf) {
      buf = await sharp(Buffer.from(cleanSvg), { density: 300 })
        .resize(s, s)
        .png({ compressionLevel: 9 })
        .toBuffer();
    }
    icoEntries.push({ width: s, height: s, buffer: buf });
  }
  const icoBuffer = createIco(icoEntries);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), icoBuffer);
  console.log(`✓ Wrote ICO: public/favicon.ico (16x16, 32x32, 48x48)`);

  console.log('\nAll brand logo and icon assets generated successfully!');
}

main().catch((err) => {
  console.error('Error generating brand icons:', err);
  process.exit(1);
});
