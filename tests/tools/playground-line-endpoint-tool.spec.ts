import test, { expect, type Page } from '@playwright/test';
import { waitForMapIdle } from '@tests/utils/basic.ts';
import { setupGeomanTest } from '@tests/utils/test-helpers.ts';

test.describe('Playground line endpoint custom tool', () => {
  let page: Page;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    await setupGeomanTest(page);
  });

  test('registers the endpoint connection playground tool', async ({ page }) => {
    const result = await page.evaluate(() => {
      const tool = window.geoman.tools.get('playground-line-endpoint-connect');

      return {
        hasTool: Boolean(tool),
        hasGeometryPreview:
          typeof window.geoman.geometry.getLineEndpointConnectionPreview === 'function',
      };
    });

    expect(result).toEqual({ hasTool: true, hasGeometryPreview: true });

    const endpointControl = page.getByRole('button', { name: 'Endpoint connect', exact: true });
    await expect(endpointControl).toBeVisible();
    await endpointControl.click();

    await expect(page.locator('[data-testid="playground-line-endpoint-status"]')).toContainText(
      'Endpoint connect',
    );
  });

  test('renders and clears endpoint connection preview while hovering a target endpoint', async ({
    page,
  }) => {
    await page.evaluate(() => {
      window.geoman.features.importGeoJsonFeature({
        type: 'Feature',
        id: 'endpoint-preview-line-a',
        properties: { shape: 'line' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 51],
            [1, 51],
          ],
        },
      });
      window.geoman.features.importGeoJsonFeature({
        type: 'Feature',
        id: 'endpoint-preview-line-b',
        properties: { shape: 'line' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [1.4, 51],
            [2, 51],
          ],
        },
      });
    });
    await waitForMapIdle(page);

    await page.getByRole('button', { name: 'Endpoint connect', exact: true }).click();

    const points = await page.evaluate(() => {
      type ProjectableMap = {
        project(lngLat: [number, number]): { x: number; y: number };
      };
      const map = window.customData!.map as unknown as ProjectableMap;
      const from = map.project([1, 51]);
      const to = map.project([1.4, 51]);
      const blank = map.project([0.25, 50.75]);

      return {
        from: { x: from.x, y: from.y },
        to: { x: to.x, y: to.y },
        blank: { x: blank.x, y: blank.y },
      };
    });

    await page.mouse.click(points.from.x, points.from.y);
    await expect(page.locator('[data-testid="playground-line-endpoint-status"]')).toContainText(
      'selected',
    );
    await page.mouse.move(points.blank.x, points.blank.y);
    await page.mouse.move(points.to.x, points.to.y);

    await expect.poll(() => getPreviewRenderedFeatureCount(page)).toBe(1);
    await expect
      .poll(() => getPreviewLayerOrder(page))
      .toMatchObject({
        previewBeforeVertexMarkers: true,
      });
    const previewGeometry = await page.evaluate(() => {
      const feature = window.mapInstance.querySourceFeatures('gm:line-endpoint-preview')[0];
      return feature?.geometry.type === 'LineString' ? feature.geometry.coordinates : null;
    });

    expect(previewGeometry).not.toBeNull();
    expect(previewGeometry?.[0]?.[0]).toBeCloseTo(1, 2);
    expect(previewGeometry?.[0]?.[1]).toBeCloseTo(51, 2);
    expect(previewGeometry?.[1]?.[0]).toBeCloseTo(1.4, 2);
    expect(previewGeometry?.[1]?.[1]).toBeCloseTo(51, 2);

    await page.mouse.click(points.blank.x, points.blank.y);
    await expect.poll(() => getPreviewRenderedFeatureCount(page)).toBe(0);

    await page.getByRole('button', { name: 'Endpoint connect', exact: true }).click();
    await expect.poll(() => getPreviewRenderedFeatureCount(page)).toBe(0);
  });
});

async function getPreviewRenderedFeatureCount(page: Page) {
  return page.evaluate(() => {
    if (!window.mapInstance.getLayer('gm:line-endpoint-preview-layer')) {
      return 0;
    }

    return window.mapInstance.queryRenderedFeatures({
      layers: ['gm:line-endpoint-preview-layer'],
    }).length;
  });
}

async function getPreviewLayerOrder(page: Page) {
  return page.evaluate(() => {
    const layerIds = window.mapInstance.getStyle().layers.map((layer) => layer.id);
    const previewIndex = layerIds.indexOf('gm:line-endpoint-preview-layer');
    const markerIndex = layerIds.indexOf('gm_main-vertex_marker__circle-layer-0');

    return {
      previewIndex,
      markerIndex,
      previewBeforeVertexMarkers:
        previewIndex !== -1 && markerIndex !== -1 && previewIndex < markerIndex,
    };
  });
}
