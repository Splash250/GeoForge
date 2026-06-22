const tileProxyPath = '/__geoforge_tile_proxy';

export function buildCustomRasterTileUrl(tileUrl: string, origin = getBrowserOrigin()): string {
  if (!origin) {
    return tileUrl;
  }

  let url: URL;

  try {
    url = new URL(tileUrl);
  } catch {
    return tileUrl;
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.origin === origin) {
    return tileUrl;
  }

  const encodedUrl = encodeURIComponent(tileUrl)
    .replaceAll('%7Bbbox-epsg-3857%7D', '{bbox-epsg-3857}')
    .replaceAll('%7Bz%7D', '{z}')
    .replaceAll('%7Bx%7D', '{x}')
    .replaceAll('%7By%7D', '{y}');

  return `${tileProxyPath}?url=${encodedUrl}`;
}

function getBrowserOrigin(): string | undefined {
  return typeof window === 'undefined' ? undefined : window.location.origin;
}
