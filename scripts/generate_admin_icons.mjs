import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SOURCE_LIGHT_SVG = '/Users/PHUC/Downloads/svgai-classic.svg';
const SOURCE_DARK_SVG = '/Users/PHUC/Desktop/admin-modern-recolored.svg';

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

function cleanSvg(content) {
  return content
    .replace('preserveAspectRatio="none"', 'preserveAspectRatio="xMidYMid meet"')
    .trim();
}

async function processTheme(themeName, sourcePath, isDark = false) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source SVG not found at ${sourcePath}`);
  }

  const rawSvg = fs.readFileSync(sourcePath, 'utf8');
  const svgClean = cleanSvg(rawSvg);
  const prefix = isDark ? 'admin-logo-dark' : 'admin-logo';
  const pwaPrefix = isDark ? 'admin-pwa-dark' : 'admin-pwa';

  // 1. Write vector SVG
  const svgOutPath = path.join(ICONS_DIR, `${prefix}.svg`);
  fs.writeFileSync(svgOutPath, svgClean, 'utf8');
  console.log(`✓ [${themeName}] Wrote SVG: public/icons/${prefix}.svg`);

  // 2. Render WebP logo (512x512)
  const webpBuf = await sharp(Buffer.from(svgClean), { density: 300 })
    .resize(512, 512)
    .webp({ quality: 95, effort: 6 })
    .toBuffer();
  fs.writeFileSync(path.join(ICONS_DIR, `${prefix}.webp`), webpBuf);
  console.log(`✓ [${themeName}] Wrote WebP: public/icons/${prefix}.webp (512x512)`);

  // 3. Render PNG sizes for PWA & icons
  const sizes = [512, 192, 180, 96, 48, 32, 16];
  const pngBySizes = new Map();

  for (const size of sizes) {
    const pngBuf = await sharp(Buffer.from(svgClean), { density: 300 })
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toBuffer();
    pngBySizes.set(size, pngBuf);

    fs.writeFileSync(path.join(ICONS_DIR, `${pwaPrefix}-${size}.png`), pngBuf);
    console.log(`✓ [${themeName}] Wrote PNG: public/icons/${pwaPrefix}-${size}.png`);
  }

  // 4. Generate multi-resolution favicon.ico
  const icoSizes = [16, 32, 48];
  const icoEntries = [];
  for (const s of icoSizes) {
    const buf = pngBySizes.get(s);
    icoEntries.push({ width: s, height: s, buffer: buf });
  }
  const icoBuffer = createIco(icoEntries);
  const icoFilename = isDark ? 'admin-favicon-dark.ico' : 'admin-favicon.ico';
  fs.writeFileSync(path.join(ICONS_DIR, icoFilename), icoBuffer);
  if (!isDark) {
    fs.writeFileSync(path.join(PUBLIC_DIR, 'admin-favicon.ico'), icoBuffer);
  }
  console.log(`✓ [${themeName}] Wrote ICO: public/icons/${icoFilename}`);
}

async function main() {
  fs.mkdirSync(ICONS_DIR, { recursive: true });

  console.log('Generating Light Mode Admin assets...');
  await processTheme('Light', SOURCE_LIGHT_SVG, false);

  console.log('\nGenerating Dark Mode Admin assets...');
  await processTheme('Dark', SOURCE_DARK_SVG, true);

  console.log('\nAll Light & Dark Admin logos and PWA icon assets generated successfully!');
}

main().catch((err) => {
  console.error('Error generating admin icons:', err);
  process.exit(1);
});

