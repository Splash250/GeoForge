import type { AnyEventName } from '@/main.ts';
import test, { expect, type Page } from '@playwright/test';
import { disableMode, enableMode } from '@tests/utils/basic.ts';
import {
  getGeomanEventResultById,
  saveGeomanEventResultToCustomData,
} from '@tests/utils/events.ts';
import { getFeatureMarkersData, getRenderedFeaturesData } from '@tests/utils/features.ts';
import { setupGeomanTest } from '@tests/utils/test-helpers.ts';

test.describe('Click To Edit Helper', () => {
  let page: Page;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    await setupGeomanTest(page, { loadFixture: 'one-shape-of-each-type' });
  });

  test('click_to_edit starts with no editable features', async () => {
    await enableMode(page, 'helper', 'click_to_edit');
    await enableMode(page, 'edit', 'change');

    const result = await page.evaluate(() => ({
      selected: window.geoman.selection.getSelectedFeatureId(),
      editableIds: Array.from(window.geoman.editableFeatureIds ?? []),
    }));

    expect(result.selected).toBeNull();
    expect(result.editableIds).toEqual([]);
  });

  test('api selection scopes edit handles to one feature', async () => {
    await enableMode(page, 'helper', 'click_to_edit');
    await enableMode(page, 'edit', 'change');

    const features = await getRenderedFeaturesData({
      page,
      temporary: false,
      allowedTypes: ['line', 'polygon'],
    });
    const line = features.find((feature) => feature.shape === 'line');
    const polygon = features.find((feature) => feature.shape === 'polygon');

    expect(line, 'Fixture must include a line feature').toBeDefined();
    expect(polygon, 'Fixture must include a polygon feature').toBeDefined();
    if (!line || !polygon) {
      return;
    }

    const result = await page.evaluate((featureId) => {
      const feature = window.geoman.features.get(
        window.geoman.features.defaultSourceName,
        featureId,
      );
      window.geoman.selection.selectFeature(feature, { reason: 'api' });

      return {
        selected: window.geoman.selection.getSelectedFeatureId(),
        editableIds: Array.from(window.geoman.editableFeatureIds ?? []),
      };
    }, line.id);

    const lineMarkers = await getFeatureMarkersData({
      page,
      featureId: line.id,
      temporary: false,
    });
    const polygonMarkers = await getFeatureMarkersData({
      page,
      featureId: polygon.id,
      temporary: false,
    });

    expect(result.selected).toBe(line.id);
    expect(result.editableIds).toEqual([line.id]);
    expect(lineMarkers.length).toBeGreaterThan(0);
    expect(polygonMarkers).toEqual([]);
  });

  test('single feature edit mode API enables selection and scoped editing across editable shapes', async () => {
    await page.evaluate(() => {
      window.geoman.enableSingleFeatureEditMode();
    });

    const initial = await page.evaluate(() => ({
      clickToEdit: window.geoman.isModeEnabled('helper', 'click_to_edit'),
      change: window.geoman.isModeEnabled('edit', 'change'),
      selected: window.geoman.getSelectedFeature()?.id ?? null,
      editableIds: Array.from(window.geoman.editableFeatureIds ?? []),
    }));

    expect(initial).toEqual({
      clickToEdit: true,
      change: true,
      selected: null,
      editableIds: [],
    });

    const features = await getRenderedFeaturesData({
      page,
      temporary: false,
      allowedTypes: ['line', 'polygon', 'rectangle', 'circle', 'ellipse'],
    });
    const selectedFeatureByShape = new Map(features.map((feature) => [feature.shape, feature]));

    for (const shape of ['line', 'polygon', 'rectangle', 'circle', 'ellipse'] as const) {
      const feature = selectedFeatureByShape.get(shape);
      expect(feature, `Fixture must include a ${shape} feature`).toBeDefined();
      if (!feature) {
        continue;
      }

      const result = await page.evaluate((featureId) => {
        const feature = window.geoman.features.get(
          window.geoman.features.defaultSourceName,
          featureId,
        );
        window.geoman.selection.selectFeature(feature, { reason: 'api' });

        return {
          selected: window.geoman.getSelectedFeature()?.id ?? null,
          editableIds: Array.from(window.geoman.editableFeatureIds ?? []),
        };
      }, feature.id);

      expect(result).toEqual({
        selected: feature.id,
        editableIds: [feature.id],
      });
    }

    await page.evaluate(() => {
      window.geoman.disableSingleFeatureEditMode();
    });

    const disabled = await page.evaluate(() => ({
      clickToEdit: window.geoman.isModeEnabled('helper', 'click_to_edit'),
      change: window.geoman.isModeEnabled('edit', 'change'),
      selected: window.geoman.getSelectedFeature()?.id ?? null,
      editableIds: window.geoman.editableFeatureIds,
    }));

    expect(disabled).toEqual({
      clickToEdit: false,
      change: false,
      selected: null,
      editableIds: null,
    });
  });

  test('clicking a feature selects it and blank map click clears selection', async () => {
    await enableMode(page, 'helper', 'click_to_edit');
    await enableMode(page, 'edit', 'change');

    const features = await getRenderedFeaturesData({
      page,
      temporary: false,
      allowedTypes: ['line'],
    });
    const line = features.find((feature) => feature.shape === 'line');
    expect(line, 'Fixture must include a line feature').toBeDefined();
    if (!line) {
      return;
    }

    const featurePoint = await getFeatureClickPoint(page, line.id);
    expect(featurePoint, 'Line click point should be visible').toBeDefined();
    if (!featurePoint) {
      return;
    }

    await page.mouse.click(featurePoint[0], featurePoint[1]);

    await expect
      .poll(() => page.evaluate(() => window.geoman.selection.getSelectedFeatureId()))
      .toBe(line.id);

    const blankPoint = await getBlankMapClickPoint(page);
    await page.mouse.click(blankPoint[0], blankPoint[1]);

    await expect
      .poll(() => page.evaluate(() => window.geoman.selection.getSelectedFeatureId()))
      .toBeNull();
  });

  test('emits feature hover and hover end only when the resolved feature changes', async () => {
    await enableMode(page, 'helper', 'click_to_edit');
    await startRecordingGeomanInteractionEvents(page, ['featurehover', 'featurehoverend']);

    const features = await getRenderedFeaturesData({
      page,
      temporary: false,
      allowedTypes: ['line'],
    });
    const line = features.find((feature) => feature.shape === 'line');
    expect(line, 'Fixture must include a line feature').toBeDefined();
    if (!line) {
      return;
    }

    const result = await page.evaluate((featureId) => {
      const geoman = window.geoman;
      const feature = geoman.features.get(geoman.features.defaultSourceName, featureId);
      const helper = geoman.actionInstances.helper__click_to_edit;
      if (!feature || !helper) {
        throw new Error('Expected click_to_edit helper and fixture feature');
      }

      const pointerEvent = {
        type: 'mousemove',
        point: { x: 10, y: 20 },
        lngLat: { lng: 1, lat: 2, toArray: () => [1, 2] },
        originalEvent: new MouseEvent('mousemove'),
      };
      geoman.features.getFeatureByMouseEvent = () => feature;
      (helper as unknown as { onMouseMove: (event: unknown) => unknown }).onMouseMove(pointerEvent);
      (helper as unknown as { onMouseMove: (event: unknown) => unknown }).onMouseMove(pointerEvent);

      geoman.features.getFeatureByMouseEvent = () => null;
      (helper as unknown as { onMouseMove: (event: unknown) => unknown }).onMouseMove(pointerEvent);

      return {
        hovered: geoman.selection.getState().hoveredFeatureId,
      };
    }, line.id);

    await expect.poll(() => getRecordedInteractionEventCount(page)).toBe(2);

    const events = await getRecordedInteractionEvents(page);
    expect(result.hovered).toBeNull();
    expect(events).toEqual([
      expect.objectContaining({
        name: 'gm:featurehover',
        action: 'feature_hover',
        mode: 'click_to_edit',
        featureId: line.id,
        previousFeatureId: null,
        sourceName: 'gm_main',
        point: { x: 10, y: 20 },
        lngLat: { lng: 1, lat: 2 },
        hasOriginalEvent: true,
        mapMatches: true,
      }),
      expect.objectContaining({
        name: 'gm:featurehoverend',
        action: 'feature_hover_end',
        mode: 'click_to_edit',
        featureId: line.id,
        reason: 'feature-leave',
        mapMatches: true,
      }),
    ]);
  });

  test('emits feature hover end when click_to_edit mode ends', async () => {
    await enableMode(page, 'helper', 'click_to_edit');
    await startRecordingGeomanInteractionEvents(page, ['featurehoverend']);

    const features = await getRenderedFeaturesData({
      page,
      temporary: false,
      allowedTypes: ['line'],
    });
    const line = features.find((feature) => feature.shape === 'line');
    expect(line, 'Fixture must include a line feature').toBeDefined();
    if (!line) {
      return;
    }

    await page.evaluate((featureId) => {
      const geoman = window.geoman;
      const feature = geoman.features.get(geoman.features.defaultSourceName, featureId);
      const helper = geoman.actionInstances.helper__click_to_edit;
      if (!feature || !helper) {
        throw new Error('Expected click_to_edit helper and fixture feature');
      }

      geoman.selection.setHoveredFeature(feature);
    }, line.id);

    await disableMode(page, 'helper', 'click_to_edit');
    await expect.poll(() => getRecordedInteractionEventCount(page)).toBe(1);

    const events = await getRecordedInteractionEvents(page);
    expect(events[0]).toEqual(
      expect.objectContaining({
        name: 'gm:featurehoverend',
        action: 'feature_hover_end',
        mode: 'click_to_edit',
        featureId: line.id,
        reason: 'mode-end',
        mapMatches: true,
      }),
    );
  });

  test('feature click event is forwarded before select and does not emit blank click', async () => {
    await enableMode(page, 'helper', 'click_to_edit');
    await enableMode(page, 'edit', 'change');
    await startRecordingGeomanInteractionEvents(page, ['featureclick', 'select', 'mapblankclick']);

    const features = await getRenderedFeaturesData({
      page,
      temporary: false,
      allowedTypes: ['line'],
    });
    const line = features.find((feature) => feature.shape === 'line');
    expect(line, 'Fixture must include a line feature').toBeDefined();
    if (!line) {
      return;
    }

    const selected = await page.evaluate((featureId) => {
      const geoman = window.geoman;
      const feature = geoman.features.get(geoman.features.defaultSourceName, featureId);
      const helper = geoman.actionInstances.helper__click_to_edit;
      if (!feature || !helper) {
        throw new Error('Expected click_to_edit helper and fixture feature');
      }

      geoman.features.getFeatureByMouseEvent = () => feature;
      (helper as unknown as { onClick: (event: unknown) => unknown }).onClick({
        type: 'click',
        point: { x: 10, y: 20 },
        lngLat: { lng: 1, lat: 2, toArray: () => [1, 2] },
        originalEvent: new MouseEvent('click'),
      });

      return geoman.selection.getSelectedFeatureId();
    }, line.id);

    await expect.poll(() => getRecordedInteractionEventCount(page)).toBe(2);

    const events = await getRecordedInteractionEvents(page);
    expect(selected).toBe(line.id);
    expect(events.map((event) => event.name)).toEqual(['gm:featureclick', 'gm:select']);
    expect(events[0]).toEqual(
      expect.objectContaining({
        name: 'gm:featureclick',
        action: 'feature_click',
        mode: 'click_to_edit',
        featureId: line.id,
        sourceName: 'gm_main',
        point: { x: 10, y: 20 },
        lngLat: { lng: 1, lat: 2 },
        hasOriginalEvent: true,
        mapMatches: true,
      }),
    );
  });

  test('click_to_edit respects selectableFeatureFilter for hover and selection', async () => {
    await enableMode(page, 'helper', 'click_to_edit');
    await enableMode(page, 'edit', 'change');
    await startRecordingGeomanInteractionEvents(page, ['featurehover', 'select']);

    const features = await getRenderedFeaturesData({
      page,
      temporary: false,
      allowedTypes: ['line'],
    });
    const line = features.find((feature) => feature.shape === 'line');
    expect(line, 'Fixture must include a line feature').toBeDefined();
    if (!line) {
      return;
    }

    const result = await page.evaluate((featureId) => {
      const geoman = window.geoman;
      const feature = geoman.features.get(geoman.features.defaultSourceName, featureId);
      const helper = geoman.actionInstances.helper__click_to_edit;
      if (!feature || !helper) {
        throw new Error('Expected click_to_edit helper and fixture feature');
      }

      geoman.selection.configure({
        selectableFeatureFilter: ({ feature: item }) => item.id !== featureId,
      });
      geoman.features.getFeatureByMouseEvent = () => feature;

      const pointerEvent = {
        type: 'click',
        point: { x: 10, y: 20 },
        lngLat: { lng: 1, lat: 2, toArray: () => [1, 2] },
        originalEvent: new MouseEvent('click'),
      };
      (helper as unknown as { onMouseMove: (event: unknown) => unknown }).onMouseMove(pointerEvent);
      (helper as unknown as { onClick: (event: unknown) => unknown }).onClick(pointerEvent);

      return {
        selected: geoman.selection.getSelectedFeatureId(),
        hovered: geoman.selection.getState().hoveredFeatureId,
        cursor: geoman.mapAdapter.getCanvas().style.cursor,
      };
    }, line.id);

    expect(result).toEqual({
      selected: null,
      hovered: null,
      cursor: '',
    });
    await expect.poll(() => getRecordedInteractionEventCount(page)).toBe(0);
  });

  test('click_to_edit respects beforeSelect veto without clearing current selection', async () => {
    await enableMode(page, 'helper', 'click_to_edit');
    await enableMode(page, 'edit', 'change');

    const features = await getRenderedFeaturesData({
      page,
      temporary: false,
      allowedTypes: ['line', 'polygon'],
    });
    const line = features.find((feature) => feature.shape === 'line');
    const polygon = features.find((feature) => feature.shape === 'polygon');
    expect(line, 'Fixture must include a line feature').toBeDefined();
    expect(polygon, 'Fixture must include a polygon feature').toBeDefined();
    if (!line || !polygon) {
      return;
    }

    await startRecordingGeomanInteractionEvents(page, ['featureclick', 'select', 'deselect']);
    await page.evaluate(
      ({ selectedFeatureId, vetoedFeatureId }) => {
        const geoman = window.geoman;
        const selectedFeature = geoman.features.get(
          geoman.features.defaultSourceName,
          selectedFeatureId,
        );
        if (!selectedFeature) {
          throw new Error('Expected selected fixture feature');
        }

        geoman.selection.selectFeature(selectedFeature, { reason: 'api' });
        geoman.selection.configure({
          beforeSelect: ({ feature }) => feature.id !== vetoedFeatureId,
        });
      },
      { selectedFeatureId: line.id, vetoedFeatureId: polygon.id },
    );
    await expect.poll(() => getRecordedInteractionEventCount(page)).toBe(1);
    await page.evaluate(() => {
      const recordedEvents = window.customData.rawEventResults?._interactionEvents;
      if (Array.isArray(recordedEvents)) {
        recordedEvents.length = 0;
      }
    });

    const result = await page.evaluate((featureId) => {
      const geoman = window.geoman;
      const feature = geoman.features.get(geoman.features.defaultSourceName, featureId);
      const helper = geoman.actionInstances.helper__click_to_edit;
      if (!feature || !helper) {
        throw new Error('Expected click_to_edit helper and fixture feature');
      }

      geoman.features.getFeatureByMouseEvent = () => feature;
      (helper as unknown as { onClick: (event: unknown) => unknown }).onClick({
        type: 'click',
        point: { x: 10, y: 20 },
        lngLat: { lng: 1, lat: 2, toArray: () => [1, 2] },
        originalEvent: new MouseEvent('click'),
      });

      return {
        selected: geoman.selection.getSelectedFeatureId(),
        editableIds: Array.from(geoman.editableFeatureIds ?? []),
      };
    }, polygon.id);

    expect(result.selected).toBe(line.id);
    expect(result.editableIds).toEqual([line.id]);
    await expect.poll(() => getRecordedInteractionEventCount(page)).toBe(1);

    const events = await getRecordedInteractionEvents(page);
    expect(events[0]).toEqual(
      expect.objectContaining({
        name: 'gm:featureclick',
        featureId: polygon.id,
      }),
    );
  });

  test('blank click clears stale hover state and cursor without blank mousemove', async () => {
    await enableMode(page, 'helper', 'click_to_edit');
    await startRecordingGeomanInteractionEvents(page, ['featurehoverend', 'mapblankclick']);

    const features = await getRenderedFeaturesData({
      page,
      temporary: false,
      allowedTypes: ['line'],
    });
    const line = features.find((feature) => feature.shape === 'line');
    expect(line, 'Fixture must include a line feature').toBeDefined();
    if (!line) {
      return;
    }

    const result = await page.evaluate((featureId) => {
      const geoman = window.geoman;
      const feature = geoman.features.get(geoman.features.defaultSourceName, featureId);
      const helper = geoman.actionInstances.helper__click_to_edit;
      if (!feature || !helper) {
        throw new Error('Expected click_to_edit helper and fixture feature');
      }

      geoman.selection.setHoveredFeature(feature);
      geoman.mapAdapter.setCursor('pointer');
      geoman.features.getFeatureByMouseEvent = () => null;

      (helper as unknown as { onClick: (event: unknown) => unknown }).onClick({
        type: 'click',
        point: { x: 0, y: 0 },
        lngLat: { lng: 0, lat: 0, toArray: () => [0, 0] },
        originalEvent: new MouseEvent('click'),
      });

      return {
        hovered: geoman.selection.getState().hoveredFeatureId,
        cursor: geoman.mapAdapter.getCanvas().style.cursor,
      };
    }, line.id);

    expect(result.hovered).toBeNull();
    expect(result.cursor).toBe('');
    await expect.poll(() => getRecordedInteractionEventCount(page)).toBe(2);

    const events = await getRecordedInteractionEvents(page);
    expect(events).toEqual([
      expect.objectContaining({
        name: 'gm:mapblankclick',
        action: 'map_blank_click',
        mode: 'click_to_edit',
        point: { x: 0, y: 0 },
        lngLat: { lng: 0, lat: 0 },
        hasOriginalEvent: true,
        mapMatches: true,
      }),
      expect.objectContaining({
        name: 'gm:featurehoverend',
        action: 'feature_hover_end',
        mode: 'click_to_edit',
        featureId: line.id,
        reason: 'map-click',
        mapMatches: true,
      }),
    ]);
  });

  test('clearOnMapClick false preserves selection hover and cursor on blank click', async () => {
    await enableMode(page, 'helper', 'click_to_edit');
    await startRecordingGeomanInteractionEvents(page, ['featurehoverend', 'mapblankclick']);

    const features = await getRenderedFeaturesData({
      page,
      temporary: false,
      allowedTypes: ['line'],
    });
    const line = features.find((feature) => feature.shape === 'line');
    expect(line, 'Fixture must include a line feature').toBeDefined();
    if (!line) {
      return;
    }

    const result = await page.evaluate((featureId) => {
      const geoman = window.geoman;
      const feature = geoman.features.get(geoman.features.defaultSourceName, featureId);
      const helper = geoman.actionInstances.helper__click_to_edit;
      if (!feature || !helper) {
        throw new Error('Expected click_to_edit helper and fixture feature');
      }

      geoman.selection.configure({ clearOnMapClick: false });
      geoman.selection.selectFeature(feature, { reason: 'api' });
      geoman.selection.setHoveredFeature(feature);
      geoman.mapAdapter.setCursor('pointer');
      geoman.features.getFeatureByMouseEvent = () => null;

      (helper as unknown as { onClick: (event: unknown) => unknown }).onClick({
        type: 'click',
        point: { x: 0, y: 0 },
        lngLat: { lng: 0, lat: 0, toArray: () => [0, 0] },
        originalEvent: new MouseEvent('click'),
      });

      return {
        selected: geoman.selection.getSelectedFeatureId(),
        hovered: geoman.selection.getState().hoveredFeatureId,
        cursor: geoman.mapAdapter.getCanvas().style.cursor,
      };
    }, line.id);

    expect(result.selected).toBe(line.id);
    expect(result.hovered).toBe(line.id);
    expect(result.cursor).toBe('pointer');
    await expect.poll(() => getRecordedInteractionEventCount(page)).toBe(1);

    const events = await getRecordedInteractionEvents(page);
    expect(events[0]).toEqual(
      expect.objectContaining({
        name: 'gm:mapblankclick',
        action: 'map_blank_click',
        mode: 'click_to_edit',
        point: { x: 0, y: 0 },
        lngLat: { lng: 0, lat: 0 },
        hasOriginalEvent: true,
        mapMatches: true,
      }),
    );
  });

  test('clicking a generated edit marker keeps the parent feature selected', async () => {
    await enableMode(page, 'helper', 'click_to_edit');
    await enableMode(page, 'edit', 'change');

    const features = await getRenderedFeaturesData({
      page,
      temporary: false,
      allowedTypes: ['line'],
    });
    const line = features.find((feature) => feature.shape === 'line');
    expect(line, 'Fixture must include a line feature').toBeDefined();
    if (!line) {
      return;
    }

    await page.evaluate((featureId) => {
      const feature = window.geoman.features.get(
        window.geoman.features.defaultSourceName,
        featureId,
      );
      window.geoman.selection.selectFeature(feature, { reason: 'api' });
    }, line.id);

    const markersBeforeClick = await getFeatureMarkersData({
      page,
      featureId: line.id,
      temporary: false,
    });
    expect(markersBeforeClick.length).toBeGreaterThan(0);

    const markerPoint = await getMarkerChildClickPoint(page, line.id);
    expect(markerPoint, 'A generated marker child should be clickable').toBeDefined();
    if (!markerPoint) {
      return;
    }

    await page.mouse.click(markerPoint[0], markerPoint[1]);

    const result = await page.evaluate(() => ({
      selected: window.geoman.selection.getSelectedFeatureId(),
      editableIds: Array.from(window.geoman.editableFeatureIds ?? []),
    }));
    const markersAfterClick = await getFeatureMarkersData({
      page,
      featureId: line.id,
      temporary: false,
    });

    expect(result.selected).toBe(line.id);
    expect(result.editableIds).toEqual([line.id]);
    expect(markersAfterClick.length).toBeGreaterThan(0);
  });

  test('clicking when the map query returns a marker child keeps the parent selected', async () => {
    await enableMode(page, 'helper', 'click_to_edit');
    await enableMode(page, 'edit', 'change');
    await startRecordingGeomanInteractionEvents(page, ['featureclick']);

    const features = await getRenderedFeaturesData({
      page,
      temporary: false,
      allowedTypes: ['line'],
    });
    const line = features.find((feature) => feature.shape === 'line');
    expect(line, 'Fixture must include a line feature').toBeDefined();
    if (!line) {
      return;
    }

    await page.evaluate((featureId) => {
      const geoman = window.geoman;
      const feature = geoman.features.get(geoman.features.defaultSourceName, featureId);
      geoman.selection.selectFeature(feature, { reason: 'api' });

      const marker = Array.from(feature?.markers.values() ?? []).find(
        (item) => item.type !== 'dom',
      );
      if (!marker) {
        throw new Error('Expected a generated feature marker');
      }

      geoman.features.getFeatureByMouseEvent = () => marker.instance;
    }, line.id);

    const blankPoint = await getBlankMapClickPoint(page);
    await page.mouse.click(blankPoint[0], blankPoint[1]);

    const result = await page.evaluate(() => ({
      selected: window.geoman.selection.getSelectedFeatureId(),
      editableIds: Array.from(window.geoman.editableFeatureIds ?? []),
    }));
    const markersAfterClick = await getFeatureMarkersData({
      page,
      featureId: line.id,
      temporary: false,
    });

    expect(result.selected).toBe(line.id);
    expect(result.editableIds).toEqual([line.id]);
    expect(markersAfterClick.length).toBeGreaterThan(0);
    await expect.poll(() => getRecordedInteractionEventCount(page)).toBe(1);

    const events = await getRecordedInteractionEvents(page);
    expect(events[0]).toEqual(
      expect.objectContaining({
        name: 'gm:featureclick',
        featureId: line.id,
      }),
    );
  });

  test('escape clears selection and blocks editing again', async () => {
    await enableMode(page, 'helper', 'click_to_edit');
    await enableMode(page, 'edit', 'change');

    const features = await getRenderedFeaturesData({
      page,
      temporary: false,
      allowedTypes: ['line'],
    });
    const line = features.find((feature) => feature.shape === 'line');
    expect(line, 'Fixture must include a line feature').toBeDefined();
    if (!line) {
      return;
    }

    await page.evaluate((featureId) => {
      const feature = window.geoman.features.get(
        window.geoman.features.defaultSourceName,
        featureId,
      );
      window.geoman.selection.selectFeature(feature, { reason: 'api' });
    }, line.id);

    await page.keyboard.press('Escape');

    const result = await page.evaluate(() => ({
      selected: window.geoman.selection.getSelectedFeatureId(),
      editableIds: Array.from(window.geoman.editableFeatureIds ?? []),
    }));
    const lineMarkers = await getFeatureMarkersData({
      page,
      featureId: line.id,
      temporary: false,
    });

    expect(result.selected).toBeNull();
    expect(result.editableIds).toEqual([]);
    expect(lineMarkers).toEqual([]);
  });

  test('clearOnEscape false keeps the current selection editable', async () => {
    await enableMode(page, 'helper', 'click_to_edit');
    await enableMode(page, 'edit', 'change');

    const features = await getRenderedFeaturesData({
      page,
      temporary: false,
      allowedTypes: ['line'],
    });
    const line = features.find((feature) => feature.shape === 'line');
    expect(line, 'Fixture must include a line feature').toBeDefined();
    if (!line) {
      return;
    }

    await page.evaluate((featureId) => {
      const feature = window.geoman.features.get(
        window.geoman.features.defaultSourceName,
        featureId,
      );
      window.geoman.selection.configure({ clearOnEscape: false });
      window.geoman.selection.selectFeature(feature, { reason: 'api' });
    }, line.id);

    await page.keyboard.press('Escape');

    const result = await page.evaluate(() => ({
      selected: window.geoman.selection.getSelectedFeatureId(),
      editableIds: Array.from(window.geoman.editableFeatureIds ?? []),
    }));
    const lineMarkers = await getFeatureMarkersData({
      page,
      featureId: line.id,
      temporary: false,
    });

    expect(result.selected).toBe(line.id);
    expect(result.editableIds).toEqual([line.id]);
    expect(lineMarkers.length).toBeGreaterThan(0);
  });

  test('removing the selected feature clears selection with previous feature', async () => {
    await enableMode(page, 'helper', 'click_to_edit');
    await enableMode(page, 'edit', 'change');

    const features = await getRenderedFeaturesData({
      page,
      temporary: false,
      allowedTypes: ['line'],
    });
    const line = features.find((feature) => feature.shape === 'line');
    expect(line, 'Fixture must include a line feature').toBeDefined();
    if (!line) {
      return;
    }

    const resultId = await saveGeomanEventResultToCustomData(page, 'deselect');

    await page.evaluate((featureId) => {
      const geoman = window.geoman;
      const feature = geoman.features.get(geoman.features.defaultSourceName, featureId);
      if (!feature) {
        throw new Error('Expected fixture feature');
      }

      geoman.selection.selectFeature(feature, { reason: 'api' });
      geoman.features.delete(feature);
      geoman.events.fire('_gm:edit', {
        name: '_gm:edit:feature_removed',
        level: 'system',
        actionType: 'edit',
        mode: 'line',
        action: 'feature_removed',
        featureData: feature,
      });
    }, line.id);

    await expect
      .poll(() =>
        page.evaluate(() => ({
          selected: window.geoman.selection.getSelectedFeatureId(),
          editableIds: Array.from(window.geoman.editableFeatureIds ?? []),
        })),
      )
      .toEqual({ selected: null, editableIds: [] });

    const event = (await getGeomanEventResultById(page, resultId, {
      timeout: 3000,
    })) as { previousFeature?: { id?: string | number }; reason?: string } | undefined;

    expect(event?.previousFeature?.id).toBe(line.id);
    expect(event?.reason).toBe('feature-removed');
  });

  test('selection remains when switching edit modes but clears when drawing starts', async () => {
    await enableMode(page, 'helper', 'click_to_edit');
    await enableMode(page, 'edit', 'change');

    const features = await getRenderedFeaturesData({
      page,
      temporary: false,
      allowedTypes: ['line'],
    });
    const line = features.find((feature) => feature.shape === 'line');
    expect(line, 'Fixture must include a line feature').toBeDefined();
    if (!line) {
      return;
    }

    await page.evaluate((featureId) => {
      const feature = window.geoman.features.get(
        window.geoman.features.defaultSourceName,
        featureId,
      );
      window.geoman.selection.selectFeature(feature, { reason: 'api' });
    }, line.id);

    await enableMode(page, 'edit', 'drag');
    const afterEditSwitch = await page.evaluate(() =>
      window.geoman.selection.getSelectedFeatureId(),
    );
    expect(afterEditSwitch).toBe(line.id);

    await enableMode(page, 'draw', 'line');
    const afterDrawStart = await page.evaluate(() =>
      window.geoman.selection.getSelectedFeatureId(),
    );
    expect(afterDrawStart).toBeNull();
  });

  test('disableAllModes clears selection and restores editability', async () => {
    await enableMode(page, 'helper', 'click_to_edit');
    await enableMode(page, 'edit', 'change');

    const features = await getRenderedFeaturesData({
      page,
      temporary: false,
      allowedTypes: ['line'],
    });
    const line = features.find((feature) => feature.shape === 'line');
    expect(line, 'Fixture must include a line feature').toBeDefined();
    if (!line) {
      return;
    }

    const result = await page.evaluate((featureId) => {
      const feature = window.geoman.features.get(
        window.geoman.features.defaultSourceName,
        featureId,
      );
      window.geoman.selection.selectFeature(feature, { reason: 'api' });
      window.geoman.disableAllModes();

      return {
        selected: window.geoman.selection.getSelectedFeatureId(),
        editableIds: window.geoman.editableFeatureIds,
      };
    }, line.id);

    expect(result.selected).toBeNull();
    expect(result.editableIds).toBeNull();
  });
});

async function getFeatureClickPoint(page: Page, featureId: string | number) {
  return page.evaluate((id) => {
    const geoman = window.geoman;
    const feature = geoman.features.get(geoman.features.defaultSourceName, id);
    if (!feature) {
      return null;
    }

    const geometry = feature.getGeoJson().geometry as { coordinates?: unknown };
    const coordinates = geometry.coordinates as unknown[];
    const coordinate =
      Array.isArray(coordinates[0]) && Array.isArray(coordinates[0][0])
        ? coordinates[0][0]
        : coordinates[0];

    if (!Array.isArray(coordinate)) {
      return null;
    }

    const point = geoman.mapAdapter.project(coordinate as [number, number]);
    const rect = geoman.mapAdapter.getContainer().getBoundingClientRect();
    return [Math.round(point[0] + rect.left), Math.round(point[1] + rect.top)] as [number, number];
  }, featureId);
}

async function getBlankMapClickPoint(page: Page) {
  return page.evaluate(() => {
    const geoman = window.geoman;
    const rect = geoman.mapAdapter.getContainer().getBoundingClientRect();
    const sourceNames = [geoman.features.defaultSourceName];

    for (let x = 80; x < rect.width - 80; x += 80) {
      for (let y = 80; y < rect.height - 80; y += 80) {
        const features = geoman.mapAdapter.queryFeaturesByScreenCoordinates({
          queryCoordinates: [x, y],
          sourceNames,
        });

        if (features.length === 0) {
          return [Math.round(x + rect.left), Math.round(y + rect.top)] as [number, number];
        }
      }
    }

    throw new Error('Unable to find a blank map point');
  });
}

async function getMarkerChildClickPoint(page: Page, parentFeatureId: string | number) {
  return page.evaluate((id) => {
    const geoman = window.geoman;
    const parent = geoman.features.get(geoman.features.defaultSourceName, id);
    if (!parent) {
      return null;
    }

    const rect = geoman.mapAdapter.getContainer().getBoundingClientRect();
    const sourceNames = [geoman.features.defaultSourceName];

    for (const marker of parent.markers.values()) {
      if (marker.type === 'dom') {
        continue;
      }

      const point = geoman.mapAdapter.project(marker.position.coordinate);
      const features = geoman.mapAdapter.queryFeaturesByScreenCoordinates({
        queryCoordinates: point,
        sourceNames,
      });
      const topFeature = features[0];

      if (topFeature?.parent?.id === id) {
        return [Math.round(point[0] + rect.left), Math.round(point[1] + rect.top)] as [
          number,
          number,
        ];
      }
    }

    return null;
  }, parentFeatureId);
}

type RecordedInteractionEvent = {
  name: string | undefined;
  action: string | undefined;
  mode: string | undefined;
  featureId: string | number | null;
  previousFeatureId: string | number | null;
  reason: string | undefined;
  sourceName: string | undefined;
  point: { x?: number; y?: number } | undefined;
  lngLat: { lng?: number; lat?: number } | undefined;
  hasOriginalEvent: boolean;
  mapMatches: boolean;
};

async function startRecordingGeomanInteractionEvents(page: Page, eventNames: string[]) {
  await page.evaluate((names) => {
    const customData = window.customData ?? {};
    window.customData = {
      ...customData,
      rawEventResults: {
        ...(customData.rawEventResults ?? {}),
        _interactionEvents: [],
      },
    };

    const recordEvent = (event: unknown) => {
      const payload = event as {
        name?: string;
        action?: string;
        mode?: string;
        feature?: { id?: string | number } | null;
        previousFeature?: { id?: string | number } | null;
        reason?: string;
        sourceName?: string;
        point?: { x?: number; y?: number };
        lngLat?: { lng?: number; lat?: number };
        originalEvent?: unknown;
        map?: unknown;
      };

      const recordedEvents = window.customData.rawEventResults?.[
        '_interactionEvents'
      ] as RecordedInteractionEvent[];
      recordedEvents.push({
        name: payload.name,
        action: payload.action,
        mode: payload.mode,
        featureId: payload.feature?.id ?? null,
        previousFeatureId: payload.previousFeature?.id ?? null,
        reason: payload.reason,
        sourceName: payload.sourceName,
        point: payload.point,
        lngLat: payload.lngLat
          ? {
              lng: payload.lngLat.lng,
              lat: payload.lngLat.lat,
            }
          : undefined,
        hasOriginalEvent: Boolean(payload.originalEvent),
        mapMatches: payload.map === window.geoman.mapAdapter.getMapInstance(),
      });
    };

    for (const eventName of names) {
      window.geoman.mapAdapter.on(`gm:${eventName}` as AnyEventName, recordEvent);
    }
  }, eventNames);
}

async function getRecordedInteractionEventCount(page: Page) {
  return page.evaluate(
    () =>
      (
        window.customData.rawEventResults?.['_interactionEvents'] as
          | RecordedInteractionEvent[]
          | undefined
      )?.length ?? 0,
  );
}

async function getRecordedInteractionEvents(page: Page) {
  return page.evaluate(
    () =>
      (window.customData.rawEventResults?.['_interactionEvents'] as RecordedInteractionEvent[]) ??
      [],
  );
}
