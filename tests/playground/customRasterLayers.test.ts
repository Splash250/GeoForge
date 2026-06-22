import { buildCustomRasterTileUrl } from '../../examples/playground/src/demo-studio/map/customRasterLayers.ts';
import { describe, expect, test } from 'vitest';

describe('playground custom raster layer proxy helper', () => {
  test('wraps external tile URLs in the demo proxy while preserving MapLibre tokens', () => {
    const tileUrl =
      'https://geoserver.citiwatts.net/geoserver/hotmaps/wms?service=WMS&bbox={bbox-epsg-3857}&tile={z}/{x}/{y}';

    const proxiedUrl = buildCustomRasterTileUrl(tileUrl, 'http://127.0.0.1:5178');

    expect(proxiedUrl).toBe(
      '/__geoforge_tile_proxy?url=https%3A%2F%2Fgeoserver.citiwatts.net%2Fgeoserver%2Fhotmaps%2Fwms%3Fservice%3DWMS%26bbox%3D{bbox-epsg-3857}%26tile%3D{z}%2F{x}%2F{y}',
    );
  });

  test('leaves same-origin tile URLs unchanged', () => {
    const tileUrl = 'http://127.0.0.1:5178/tiles/{z}/{x}/{y}.png';

    expect(buildCustomRasterTileUrl(tileUrl, 'http://127.0.0.1:5178')).toBe(tileUrl);
  });
});
