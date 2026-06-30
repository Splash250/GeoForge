import test, { expect, type Page } from '@playwright/test';
import { waitForMapIdle } from '@tests/utils/basic.ts';
import { getScreenCoordinatesByLngLat } from '@tests/utils/shapes.ts';
import { setupGeomanTest } from '@tests/utils/test-helpers.ts';

test.describe('Playground segment length custom tool', () => {
  let page: Page;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    await setupGeomanTest(page);
  });

  test('shows clicked polyline segment length in meters from the playground custom tool', async () => {
    await page.evaluate(() => {
      window.geoman.features.importGeoJsonFeature({
        type: 'Feature',
        id: 'segment-measure-line',
        properties: { shape: 'line' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 51],
            [0.01, 51],
            [0.01, 51.01],
          ],
        },
      });
    });
    await waitForMapIdle(page);

    await page.getByRole('button', { name: 'Segment length', exact: true }).click();

    const clickPoint = await page.evaluate(() => {
      type ProjectableMap = {
        project(lngLat: [number, number]): { x: number; y: number };
      };
      const map = window.customData!.map as unknown as ProjectableMap;
      const point = map.project([0.005, 51]);
      return { x: point.x, y: point.y };
    });

    await page.mouse.click(clickPoint.x, clickPoint.y);

    const popupText = await page.locator('.gm-segment-length-popup').textContent();
    const lengthMatch = popupText?.match(/Segment length:\s*(\d+(?:\.\d+)?)\s*m/);

    expect(lengthMatch).not.toBeNull();
    if (!lengthMatch) {
      throw new Error(`Expected segment length popup text, got: ${popupText ?? '<empty>'}`);
    }

    const segmentLengthMeters = Number(lengthMatch[1]);
    expect(segmentLengthMeters).toBeGreaterThan(600);
    expect(segmentLengthMeters).toBeLessThan(800);
  });

  test('uses built-in selection hover feedback while the segment length tool is active', async () => {
    await page.evaluate(() => {
      window.geoman.features.importGeoJsonFeature({
        type: 'Feature',
        id: 'segment-measure-line',
        properties: { shape: 'line' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 51],
            [0.01, 51],
          ],
        },
      });
    });
    await waitForMapIdle(page);

    await page.getByRole('button', { name: 'Segment length', exact: true }).click();

    const linePoint = await getScreenCoordinatesByLngLat({ page, position: [0.005, 51] });
    expect(linePoint).not.toBeNull();
    if (!linePoint) {
      return;
    }

    await expect
      .poll(
        async () => {
          await page.mouse.move(linePoint[0], linePoint[1]);
          await page.waitForTimeout(50);
          return page.evaluate(() => window.geoman.selection.getState().hoveredFeatureId);
        },
        { timeout: 10000 },
      )
      .toBe('segment-measure-line');
    await expect
      .poll(() =>
        page.evaluate(() => {
          type CanvasMap = { getCanvas(): HTMLCanvasElement };
          return (window.customData!.map as unknown as CanvasMap).getCanvas().style.cursor;
        }),
      )
      .toBe('pointer');

    const blankPoint = await getScreenCoordinatesByLngLat({ page, position: [2, 49] });
    expect(blankPoint).not.toBeNull();
    if (!blankPoint) {
      return;
    }
    await page.mouse.move(blankPoint[0], blankPoint[1]);

    await expect
      .poll(() => page.evaluate(() => window.geoman.selection.getState().hoveredFeatureId))
      .toBeNull();
    await expect
      .poll(() =>
        page.evaluate(() => {
          type CanvasMap = { getCanvas(): HTMLCanvasElement };
          return (window.customData!.map as unknown as CanvasMap).getCanvas().style.cursor;
        }),
      )
      .toBe('');
  });

  test('clears the segment length popup on blank map click', async () => {
    await page.evaluate(() => {
      window.geoman.features.importGeoJsonFeature({
        type: 'Feature',
        id: 'segment-measure-line',
        properties: { shape: 'line' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 51],
            [0.01, 51],
          ],
        },
      });
    });
    await waitForMapIdle(page);

    await page.getByRole('button', { name: 'Segment length', exact: true }).click();

    const linePoint = await page.evaluate(() => {
      type ProjectableMap = {
        project(lngLat: [number, number]): { x: number; y: number };
      };
      const map = window.customData!.map as unknown as ProjectableMap;
      const point = map.project([0.005, 51]);
      return { x: point.x, y: point.y };
    });
    await page.mouse.click(linePoint.x, linePoint.y);
    await expect(page.locator('.gm-segment-length-popup')).toBeVisible();

    const blankPoint = await page.evaluate(() => {
      type ProjectableMap = {
        project(lngLat: [number, number]): { x: number; y: number };
      };
      const map = window.customData!.map as unknown as ProjectableMap;
      const point = map.project([2, 49]);
      return { x: point.x, y: point.y };
    });

    await page.mouse.click(blankPoint.x, blankPoint.y);
    await expect(page.locator('.gm-segment-length-popup')).toHaveCount(0);
  });

  test('opens a segment context panel from the playground custom tool', async () => {
    await importSegmentContextLine(page, 'segment-context-line');
    await openSegmentContextPanel(page);

    const panel = page.locator('.gm-context-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Segment Length');
    await expect(panel).toContainText('Segment value');
    await expect(panel).toContainText('300');
    await expect(page.getByLabel('Segment value')).toHaveValue('300');
  });

  test('context panel receives focus and closes with Escape', async () => {
    await importSegmentContextLine(page, 'segment-context-keyboard-line');
    await openSegmentContextPanel(page);

    const panel = page.locator('.gm-context-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('role', 'region');
    await expect(page.getByRole('textbox', { name: /Segment value/i })).toBeFocused();

    await page.keyboard.press('Escape');

    await expect(panel).toHaveCount(0);
  });

  test('updates a segment value from the context panel input', async () => {
    await importSegmentContextLine(page, 'segment-context-edit-line');
    await openSegmentContextPanel(page);

    const segmentValueInput = page.getByLabel('Segment value');
    await expect(segmentValueInput).toBeVisible();
    await segmentValueInput.fill('450');
    await segmentValueInput.press('Enter');
    await page.getByRole('button', { name: 'Save segment edit' }).click();

    await expect
      .poll(() =>
        page.evaluate(() => {
          const feature = window.geoman.features.get('gm_main', 'segment-context-edit-line');
          const segments = feature?.getGeoJson().properties.segments;
          return Array.isArray(segments) ? segments[0]?.segmentValue : null;
        }),
      )
      .toBe(450);
  });

  test('splits a segment and preserves segment value metadata on both resulting segments', async () => {
    await importSegmentContextLine(page, 'segment-context-split-line');
    await openSegmentContextPanel(page);

    await page.getByRole('button', { name: 'Split segment edit' }).click();
    await page.getByRole('button', { name: 'Save segment edit' }).click();

    await expect
      .poll(() =>
        page.evaluate(() => {
          const feature = window.geoman.features.get('gm_main', 'segment-context-split-line');
          const geoJson = feature?.getGeoJson();
          const segments = geoJson?.properties.segments;

          return {
            coordinateCount:
              geoJson?.geometry.type === 'LineString' ? geoJson.geometry.coordinates.length : null,
            segments: Array.isArray(segments) ? segments : null,
          };
        }),
      )
      .toEqual({
        coordinateCount: 3,
        segments: [
          { index: 0, segmentValue: 300 },
          { index: 1, segmentValue: 300 },
        ],
      });
  });

  test('locks stale segment edit controls after splitting a segment', async () => {
    await importSegmentContextLine(page, 'segment-context-split-lock-line');
    await openSegmentContextPanel(page);

    await page.getByRole('button', { name: 'Split segment edit' }).click();

    await expect(page.getByLabel('Segment value')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Split segment edit' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Save segment edit' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Cancel segment edit' })).toBeEnabled();
  });

  test('cancels a segment value edit from the context panel', async () => {
    await importSegmentContextLine(page, 'segment-context-cancel-line');
    await openSegmentContextPanel(page);

    const segmentValueInput = page.getByLabel('Segment value');
    await expect(segmentValueInput).toBeVisible();
    await segmentValueInput.fill('450');
    await segmentValueInput.press('Enter');

    await expect
      .poll(() =>
        page.evaluate(() => {
          const feature = window.geoman.features.get('gm_main', 'segment-context-cancel-line');
          const segments = feature?.getGeoJson().properties.segments;
          return Array.isArray(segments) ? segments[0]?.segmentValue : null;
        }),
      )
      .toBe(450);

    await page.getByRole('button', { name: 'Cancel segment edit' }).click();

    await expect(page.getByLabel('Segment value')).toHaveValue('300');
    await expect
      .poll(() =>
        page.evaluate(() => {
          const feature = window.geoman.features.get('gm_main', 'segment-context-cancel-line');
          const segments = feature?.getGeoJson().properties.segments;
          return Array.isArray(segments) ? segments[0]?.segmentValue : null;
        }),
      )
      .toBe(300);
  });

  test('saves a dirty segment value edit when Save is clicked directly', async () => {
    await importSegmentContextLine(page, 'segment-context-direct-save-line');
    await openSegmentContextPanel(page);

    const segmentValueInput = page.getByLabel('Segment value');
    await expect(segmentValueInput).toBeVisible();
    await segmentValueInput.fill('450');
    await page.getByRole('button', { name: 'Save segment edit' }).click();

    await expect(page.locator('.gm-context-panel')).toHaveCount(0);
    await expect
      .poll(() => getSegmentEditState(page, 'segment-context-direct-save-line'))
      .toEqual({
        activeTransaction: null,
        segmentValue: 450,
        panelCount: 0,
      });
  });

  test('cancels a dirty segment value edit when Cancel is clicked directly', async () => {
    await importSegmentContextLine(page, 'segment-context-direct-cancel-line');
    await openSegmentContextPanel(page);

    const segmentValueInput = page.getByLabel('Segment value');
    await expect(segmentValueInput).toBeVisible();
    await segmentValueInput.fill('450');
    await page.getByRole('button', { name: 'Cancel segment edit' }).click();

    await expect(page.getByLabel('Segment value')).toHaveValue('300');
    await expect
      .poll(() => getSegmentEditState(page, 'segment-context-direct-cancel-line'))
      .toEqual({
        activeTransaction: {
          id: 'segment-value-edit',
          status: 'active',
        },
        segmentValue: 300,
        panelCount: 1,
      });
  });

  test('cancels an uncommitted segment value edit when the panel closes', async () => {
    await importSegmentContextLine(page, 'segment-context-close-cancel-line');
    await openSegmentContextPanel(page);

    const segmentValueInput = page.getByLabel('Segment value');
    await expect(segmentValueInput).toBeVisible();
    await segmentValueInput.fill('450');
    await segmentValueInput.press('Enter');

    await expect
      .poll(() =>
        page.evaluate(() => {
          const feature = window.geoman.features.get(
            'gm_main',
            'segment-context-close-cancel-line',
          );
          const segments = feature?.getGeoJson().properties.segments;
          return Array.isArray(segments) ? segments[0]?.segmentValue : null;
        }),
      )
      .toBe(450);

    await page.keyboard.press('Escape');
    await expect(page.locator('.gm-context-panel')).toHaveCount(0);

    await expect
      .poll(() =>
        page.evaluate(() => {
          const feature = window.geoman.features.get(
            'gm_main',
            'segment-context-close-cancel-line',
          );
          const segments = feature?.getGeoJson().properties.segments;
          return Array.isArray(segments) ? segments[0]?.segmentValue : null;
        }),
      )
      .toBe(300);
  });

  test('renders segment context panel segment values as text', async () => {
    await importSegmentContextLine(
      page,
      'segment-context-text-line',
      '<img src=x alt="unsafe-segment-value">',
    );
    await openSegmentContextPanel(page);

    const panel = page.locator('.gm-context-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('<img src=x alt="unsafe-segment-value">');
    await expect(panel.locator('img')).toHaveCount(0);
  });

  test('closes the segment context panel on blank map context menu', async () => {
    await importSegmentContextLine(page, 'segment-context-blank-close-line');
    await page.getByRole('button', { name: 'Segment length', exact: true }).click();
    await rightClickMapPoint(page, [0.005, 51]);
    await expect(page.locator('.gm-context-panel')).toBeVisible();

    await rightClickMapPoint(page, [2, 49]);
    await expect(page.locator('.gm-context-panel')).toHaveCount(0);
  });
});

async function importSegmentContextLine(page: Page, id: string, segmentValue: unknown = 300) {
  await page.evaluate(
    ({ featureId, segmentValue }) => {
      window.geoman.features.importGeoJsonFeature({
        type: 'Feature',
        id: featureId,
        properties: {
          shape: 'line',
          segments: [{ index: 0, segmentValue }],
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 51],
            [0.01, 51],
          ],
        },
      });
    },
    { featureId: id, segmentValue },
  );
  await waitForMapIdle(page);
}

async function openSegmentContextPanel(page: Page) {
  await page.getByRole('button', { name: 'Segment length', exact: true }).click();
  await rightClickMapPoint(page, [0.005, 51]);
}

async function getSegmentEditState(page: Page, featureId: string) {
  return page.evaluate((id) => {
    const feature = window.geoman.features.get('gm_main', id);
    const segments = feature?.getGeoJson().properties.segments;
    const activeTransaction = window.geoman.transactions.getActive();

    return {
      activeTransaction: activeTransaction
        ? { id: activeTransaction.id, status: activeTransaction.status }
        : null,
      segmentValue: Array.isArray(segments) ? segments[0]?.segmentValue : null,
      panelCount: document.querySelectorAll('.gm-context-panel').length,
    };
  }, featureId);
}

async function rightClickMapPoint(page: Page, lngLat: [number, number]) {
  const point = await getScreenCoordinatesByLngLat({ page, position: lngLat });

  if (!point) {
    throw new Error(`Could not project map point ${lngLat.join(', ')}`);
  }

  await page.mouse.click(point[0], point[1], { button: 'right' });
}
