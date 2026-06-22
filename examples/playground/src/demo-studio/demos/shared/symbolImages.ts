import type { Map } from 'maplibre-gl';

const CHEVRON_IMAGE_ID = 'gf-demo-chevron';
const DIAMOND_IMAGE_ID = 'gf-demo-diamond';
const DOT_IMAGE_ID = 'gf-demo-dot';

export async function ensureBaseSymbolImages(map: Map): Promise<void> {
  await Promise.all([
    ensureSvgImage(map, CHEVRON_IMAGE_ID, chevronSvg('#0f766e')),
    ensureSvgImage(map, DIAMOND_IMAGE_ID, diamondSvg('#be123c')),
    ensureSvgImage(map, DOT_IMAGE_ID, dotSvg('#2563eb')),
  ]);
}

export async function ensureSvgImage(map: Map, id: string, svg: string): Promise<void> {
  if (map.hasImage(id)) {
    return;
  }

  const image = await svgToImage(svg);

  if (!map.hasImage(id)) {
    map.addImage(id, image);
  }
}

function svgToImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image(32, 32);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to load SVG image'));
    };

    image.src = url;
  });
}

export function chevronSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M7 16h17m0 0-7-7m7 7-7 7" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function diamondSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M16 3 29 16 16 29 3 16Z" fill="${color}" fill-opacity=".92"/><path d="M16 8 24 16 16 24 8 16Z" fill="#fff" fill-opacity=".78"/></svg>`;
}

export function dotSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="10" fill="${color}"/><circle cx="16" cy="16" r="4" fill="#fff"/></svg>`;
}
