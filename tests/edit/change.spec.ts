import { getCoordinateByPath } from '@/utils/geojson.ts';
import type { Page } from '@playwright/test';
import test, { expect } from '@playwright/test';
import {
  type FeatureCustomData,
  getFeatureMarkersData,
  getRenderedFeaturesData,
  loadGeoJsonFeatures,
  type MarkerCustomData,
  waitForFeatureGeoJsonUpdate,
  waitForRenderedFeatureData,
} from '@tests/utils/features.ts';
import {
  configurePageTimeouts,
  enableMode,
  type ScreenCoordinates,
  waitForGeoman,
  waitForMapIdle,
} from '@tests/utils/basic.ts';
import { loadGeoJson } from '@tests/utils/fixtures.ts';
import { getScreenCoordinatesByLngLat } from '@tests/utils/shapes.ts';

const TOLERANCE = 2;
const POINT_BASED_SHAPES = ['marker', 'circle_marker', 'text_marker'];

const changeDragAndDrop = async (
  page: Page,
  startPoint: ScreenCoordinates,
  targetPoint: ScreenCoordinates,
) => {
  await page.mouse.move(startPoint[0], startPoint[1]);
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.waitForTimeout(100);

  const steps = 16;
  for (let i = 1; i <= steps; i++) {
    const x = startPoint[0] + (targetPoint[0] - startPoint[0]) * (i / steps);
    const y = startPoint[1] + (targetPoint[1] - startPoint[1]) * (i / steps);
    await page.mouse.move(x, y);
    await page.waitForTimeout(20);
  }

  await page.mouse.up();
  await page.waitForTimeout(200);
  await waitForMapIdle(page);
};

const getDraggableVertexForShape = async (
  page: Page,
  feature: FeatureCustomData,
): Promise<MarkerCustomData | null> => {
  const markers = await getFeatureMarkersData({
    page,
    featureId: feature.id,
    temporary: false, // Markers are on the main source after enabling edit mode
    allowedTypes: ['vertex'],
  });
  return markers.length > 0 ? markers[0] : null;
};

const performDragAndVerifyVertex = async (
  page: Page,
  feature: FeatureCustomData,
  vertexMarker: MarkerCustomData,
  offsetX: number,
  offsetY: number,
) => {
  expect(vertexMarker.path, `Vertex marker for ${feature.shape} must have a path`).toBeDefined();

  if (!vertexMarker.path) {
    return;
  }

  const originalGeoJson = feature.geoJson;
  const initialPoint = vertexMarker.point;
  const targetPoint: [number, number] = [initialPoint[0] + offsetX, initialPoint[1] + offsetY];

  await changeDragAndDrop(page, initialPoint, targetPoint);
  await waitForFeatureGeoJsonUpdate({ feature, originalGeoJson, page });

  const updatedFeature = await waitForRenderedFeatureData({
    page,
    featureId: feature.id,
    temporary: false,
  });
  expect(updatedFeature, `Feature ${feature.id} should be updated`).not.toBeNull();

  if (updatedFeature) {
    const updatedLngLat = getCoordinateByPath(updatedFeature.geoJson, vertexMarker.path);
    expect(
      updatedLngLat,
      `Updated LngLat for path ${vertexMarker.path.join('.')} should exist`,
    ).not.toBeNull();

    if (updatedLngLat) {
      const newScreenPos = await getScreenCoordinatesByLngLat({ page, position: updatedLngLat });
      expect(newScreenPos, 'New screen position should be calculable').not.toBeNull();

      if (newScreenPos) {
        expect(newScreenPos[0]).toBeGreaterThanOrEqual(targetPoint[0] - TOLERANCE);
        expect(newScreenPos[0]).toBeLessThanOrEqual(targetPoint[0] + TOLERANCE);
        expect(newScreenPos[1]).toBeGreaterThanOrEqual(targetPoint[1] - TOLERANCE);
        expect(newScreenPos[1]).toBeLessThanOrEqual(targetPoint[1] + TOLERANCE);
      }
    }
  }
};

test.beforeEach(async ({ page }) => {
  await configurePageTimeouts(page);
  await page.goto('/');
  await waitForGeoman(page);
  await expect(page).toHaveTitle('GeoForge Dev Harness');

  const geoJsonFeatures = await loadGeoJson('one-shape-of-each-type');
  expect(geoJsonFeatures, 'GeoJSON features should be loaded').not.toBeNull();

  if (geoJsonFeatures) {
    await loadGeoJsonFeatures({ page, geoJsonFeatures });
  }
});

test('Change/Drag each shape type', async ({ page }) => {
  const dX = 20;
  const dY = 20;

  const features = await getRenderedFeaturesData({ page, temporary: false });
  expect(features.length).toBeGreaterThan(0);

  await enableMode(page, 'edit', 'change');

  for (const feature of features) {
    const vertexMarker = await getDraggableVertexForShape(page, feature);

    if (vertexMarker) {
      await performDragAndVerifyVertex(page, feature, vertexMarker, dX, dY);
    } else {
      expect(
        POINT_BASED_SHAPES,
        `${feature.shape} should be point-based when no change vertex is available`,
      ).toContain(feature.shape);
    }
  }

  // Disable mode to reset state for the next feature
  await page.evaluate(() => window.geoman.options.disableMode('edit', 'change'));
});
