import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SOURCE_SVG_PATH = fs.existsSync('/Users/PHUC/Desktop/logo.svg')
  ? '/Users/PHUC/Desktop/logo.svg'
  : path.resolve('public/icons/logo.svg');
const DARK_SVG_PATH = fs.existsSync('/Users/PHUC/Desktop/logo_darkmode.svg')
  ? '/Users/PHUC/Desktop/logo_darkmode.svg'
  : path.resolve('public/icons/logo-dark.svg');
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

async function main() {
  if (!fs.existsSync(SOURCE_SVG_PATH)) {
    throw new Error(`Light source SVG not found at ${SOURCE_SVG_PATH}`);
  }
  if (!fs.existsSync(DARK_SVG_PATH)) {
    throw new Error(`Dark source SVG not found at ${DARK_SVG_PATH}`);
  }

  const lightSvgClean = cleanSvg(fs.readFileSync(SOURCE_SVG_PATH, 'utf8'));
  const darkSvgClean = cleanSvg(fs.readFileSync(DARK_SVG_PATH, 'utf8'));

  fs.mkdirSync(ICONS_DIR, { recursive: true });

  // 1. Write vector SVG outputs for light and dark
  const svgTargets = [
    // Light
    { path: path.join(ICONS_DIR, 'da-lieu-nhiet-doi-phu-quoc-logo.svg'), content: lightSvgClean },
    { path: path.join(ICONS_DIR, 'logo.svg'), content: lightSvgClean },
    { path: path.join(PUBLIC_DIR, 'favicon.svg'), content: lightSvgClean },
    // Dark
    { path: path.join(ICONS_DIR, 'da-lieu-nhiet-doi-phu-quoc-logo-dark.svg'), content: darkSvgClean },
    { path: path.join(ICONS_DIR, 'logo-dark.svg'), content: darkSvgClean },
    { path: path.join(PUBLIC_DIR, 'favicon-dark.svg'), content: darkSvgClean },
  ];

  for (const target of svgTargets) {
    fs.writeFileSync(target.path, target.content, 'utf8');
    console.log(`✓ Wrote SVG: ${path.relative(process.cwd(), target.path)}`);
  }

  // 2. Render WebP logos (512x512)
  const lightWebp = await sharp(Buffer.from(lightSvgClean), { density: 300 })
    .resize(512, 512)
    .webp({ quality: 95, effort: 6 })
    .toBuffer();
  fs.writeFileSync(path.join(ICONS_DIR, 'da-lieu-nhiet-doi-phu-quoc-logo.webp'), lightWebp);
  fs.writeFileSync(path.join(ICONS_DIR, 'logo.webp'), lightWebp);
  console.log(`✓ Wrote Light WebP: public/icons/da-lieu-nhiet-doi-phu-quoc-logo.webp (512x512)`);

  const darkWebp = await sharp(Buffer.from(darkSvgClean), { density: 300 })
    .resize(512, 512)
    .webp({ quality: 95, effort: 6 })
    .toBuffer();
  fs.writeFileSync(path.join(ICONS_DIR, 'da-lieu-nhiet-doi-phu-quoc-logo-dark.webp'), darkWebp);
  fs.writeFileSync(path.join(ICONS_DIR, 'logo-dark.webp'), darkWebp);
  console.log(`✓ Wrote Dark WebP: public/icons/da-lieu-nhiet-doi-phu-quoc-logo-dark.webp (512x512)`);

  // 3. Render PNG sizes for light and dark
  const sizes = [512, 192, 180, 96, 48, 32];
  const pngBySizes = new Map();

  for (const size of sizes) {
    // Light
    const pngBuf = await sharp(Buffer.from(lightSvgClean), { density: 300 })
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toBuffer();
    pngBySizes.set(size, pngBuf);

    fs.writeFileSync(path.join(ICONS_DIR, `da-lieu-nhiet-doi-phu-quoc-${size}.png`), pngBuf);
    console.log(`✓ Wrote PNG: public/icons/da-lieu-nhiet-doi-phu-quoc-${size}.png`);

    if (size === 180) {
      fs.writeFileSync(path.join(ICONS_DIR, 'apple-touch-icon.png'), pngBuf);
      fs.writeFileSync(path.join(ICONS_DIR, 'natural-skin-fern-180.png'), pngBuf);
    } else {
      fs.writeFileSync(path.join(ICONS_DIR, `icon-${size}.png`), pngBuf);
      fs.writeFileSync(path.join(ICONS_DIR, `natural-skin-fern-${size}.png`), pngBuf);
    }

    // Dark
    const darkPngBuf = await sharp(Buffer.from(darkSvgClean), { density: 300 })
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toBuffer();

    fs.writeFileSync(path.join(ICONS_DIR, `da-lieu-nhiet-doi-phu-quoc-dark-${size}.png`), darkPngBuf);
    fs.writeFileSync(path.join(ICONS_DIR, `icon-dark-${size}.png`), darkPngBuf);
    console.log(`✓ Wrote Dark PNG: public/icons/da-lieu-nhiet-doi-phu-quoc-dark-${size}.png`);
  }

  // 4. Generate multi-resolution favicon.ico (16, 32, 48)
  const icoSizes = [16, 32, 48];
  const icoEntries = [];
  for (const s of icoSizes) {
    let buf = pngBySizes.get(s);
    if (!buf) {
      buf = await sharp(Buffer.from(lightSvgClean), { density: 300 })
        .resize(s, s)
        .png({ compressionLevel: 9 })
        .toBuffer();
    }
    icoEntries.push({ width: s, height: s, buffer: buf });
  }
  const icoBuffer = createIco(icoEntries);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), icoBuffer);
  console.log(`✓ Wrote ICO: public/favicon.ico (16x16, 32x32, 48x48)`);

  console.log('\nAll light & dark brand logo and icon assets generated successfully!');
}

main().catch((err) => {
  console.error('Error generating brand icons:', err);
  process.exit(1);
});
