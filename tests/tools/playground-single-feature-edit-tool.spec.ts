import test, { expect, type Page } from '@playwright/test';
import { getFeatureMarkersData, getRenderedFeaturesData } from '@tests/utils/features.ts';
import { setupGeomanTest } from '@tests/utils/test-helpers.ts';

test.describe('Playground single feature edit custom tool', () => {
  let page: Page;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    await setupGeomanTest(page, { loadFixture: 'one-shape-of-each-type' });
  });

  test('activates generic single-feature edit mode from a custom control button', async () => {
    const editControl = page.getByRole('button', { name: 'Select feature to edit', exact: true });
    await expect(editControl).toBeVisible();

    await page.evaluate(() => {
      window.mapInstance.addSource('app-late-lines', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });
      window.mapInstance.addLayer({
        id: 'app-late-lines-layer',
        type: 'line',
        source: 'app-late-lines',
        paint: {
          'line-color': '#111827',
          'line-width': 24,
        },
      });
    });

    await editControl.click();

    await expect(editControl).toHaveClass(/active/);
    await expect
      .poll(() =>
        page.evaluate(() => ({
          activeToolId: window.geoman.tools.getActiveToolId(),
          clickToEdit: window.geoman.isModeEnabled('helper', 'click_to_edit'),
          change: window.geoman.isModeEnabled('edit', 'change'),
          selected: window.geoman.getSelectedFeature()?.id ?? null,
          editableIds: Array.from(window.geoman.editableFeatureIds ?? []),
        })),
      )
      .toEqual({
        activeToolId: 'playground-single-feature-edit',
        clickToEdit: true,
        change: true,
        selected: null,
        editableIds: [],
      });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const layerIds = window.mapInstance.getStyle().layers.map((layer) => layer.id);
          const appLayerIndex = layerIds.indexOf('app-late-lines-layer');
          const editLayerIndexes = layerIds
            .map((id, index) => ({ id, index }))
            .filter(({ id }) => /-(center|vertex|edge)_marker__/.test(id))
            .map(({ index }) => index);

          return {
            appLayerIndex,
            editLayerIndexes,
            editLayersAboveAppLayer:
              editLayerIndexes.length > 0 &&
              editLayerIndexes.every((index) => index > appLayerIndex),
          };
        }),
      )
      .toMatchObject({
        appLayerIndex: expect.any(Number),
        editLayersAboveAppLayer: true,
      });

    const features = await getRenderedFeaturesData({
      page,
      temporary: false,
      allowedTypes: ['polygon'],
    });
    const polygon = features.find((feature) => feature.shape === 'polygon');
    expect(polygon, 'Fixture must include a polygon feature').toBeDefined();
    if (!polygon) {
      return;
    }

    await page.evaluate((featureId) => {
      const feature = window.geoman.features.get(
        window.geoman.features.defaultSourceName,
        featureId,
      );
      window.geoman.selection.selectFeature(feature, { reason: 'api' });
    }, polygon.id);

    await expect
      .poll(() =>
        page.evaluate(() => ({
          selected: window.geoman.getSelectedFeature()?.id ?? null,
          editableIds: Array.from(window.geoman.editableFeatureIds ?? []),
        })),
      )
      .toEqual({
        selected: polygon.id,
        editableIds: [polygon.id],
      });

    const polygonMarkers = await getFeatureMarkersData({
      page,
      featureId: polygon.id,
      temporary: false,
    });
    expect(polygonMarkers.length).toBeGreaterThan(0);

    await editControl.click();

    await expect(editControl).not.toHaveClass(/active/);
    await expect
      .poll(() =>
        page.evaluate(() => ({
          activeToolId: window.geoman.tools.getActiveToolId(),
          clickToEdit: window.geoman.isModeEnabled('helper', 'click_to_edit'),
          change: window.geoman.isModeEnabled('edit', 'change'),
          selected: window.geoman.getSelectedFeature()?.id ?? null,
          editableIds: window.geoman.editableFeatureIds,
        })),
      )
      .toEqual({
        activeToolId: null,
        clickToEdit: false,
        change: false,
        selected: null,
        editableIds: null,
      });
  });
});
