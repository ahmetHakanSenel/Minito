import { Resvg } from 'npm:@resvg/resvg-js@2.6.2';

/**
 * Renders every raster brand asset from one vector source, so the app icon, the Android adaptive
 * icon, the splash and the favicon can never drift apart.
 *
 *   npm run brand:assets
 *
 * The mark: a lowercase "m" whose second arch climbs higher than the first, with a spark at the
 * top. Small steps, going up.
 */

// Geometry in a 120×120 design grid. Kept in sync with src/components/brand/MinitoMark.tsx.
export const MARK_PATH = 'M26 94 V64 A14 14 0 0 1 54 64 V94 M54 94 V48 A14 14 0 0 1 82 48 V94';
export const SPARK_PATH =
  'M99 10 Q101.2 19.8 111 22 Q101.2 24.2 99 34 Q96.8 24.2 87 22 Q96.8 19.8 99 10 Z';
// Visual centre of the mark (the "m" plus its spark), used to centre it on a canvas.
const MARK_CENTER = { x: 65.25, y: 55.25 };

const BACKGROUND = '#050510';

const defs = `
  <defs>
    <linearGradient id="stroke" x1="20" y1="100" x2="90" y2="30" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#7C3AED"/>
      <stop offset="0.55" stop-color="#A855F7"/>
      <stop offset="1" stop-color="#E879F9"/>
    </linearGradient>
    <linearGradient id="spark" x1="87" y1="10" x2="111" y2="34" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#F5D0FE"/>
      <stop offset="1" stop-color="#E879F9"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.45" r="0.6">
      <stop offset="0" stop-color="#4C1D95" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${BACKGROUND}" stop-opacity="0"/>
    </radialGradient>
  </defs>`;

const mark = `
  <path d="${MARK_PATH}" fill="none" stroke="url(#stroke)" stroke-width="13"
        stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${SPARK_PATH}" fill="url(#spark)"/>`;

function svg({ scale, background }: { scale: number; background: boolean }): string {
  const place = `translate(60 60) scale(${scale}) translate(${-MARK_CENTER.x} ${-MARK_CENTER.y})`;
  const backdrop = background
    ? `<rect width="120" height="120" fill="${BACKGROUND}"/><rect width="120" height="120" fill="url(#glow)"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">${defs}${backdrop}<g transform="${place}">${mark}</g></svg>`;
}

type Asset = { file: string; size: number; scale: number; background: boolean };

const ASSETS: Asset[] = [
  // Full-bleed: iOS and the store apply their own mask.
  { file: 'assets/icon.png', size: 1024, scale: 0.68, background: true },
  // Android masks the foreground to a circle of about 66% of the canvas; the mark stays inside it.
  { file: 'assets/adaptive-icon.png', size: 1024, scale: 0.56, background: false },
  { file: 'assets/splash-icon.png', size: 1024, scale: 0.56, background: false },
  // Small sizes get a larger mark: the detail that matters at 48 px is the silhouette.
  { file: 'assets/favicon.png', size: 48, scale: 0.8, background: true },
];

if (import.meta.main) {
  const outDir = Deno.args[0];
  for (const asset of ASSETS) {
    const rendered = new Resvg(svg(asset), { fitTo: { mode: 'width', value: asset.size } })
      .render()
      .asPng();
    const target = outDir ? `${outDir}/${asset.file.split('/').pop()}` : asset.file;
    await Deno.writeFile(target, rendered);
    console.log(`${target}  ${asset.size}px  ${rendered.length} bytes`);
  }
  await Deno.writeTextFile(
    outDir ? `${outDir}/minito-mark.svg` : 'assets/brand/minito-mark.svg',
    svg({ scale: 0.68, background: true }) + '\n'
  );
}
