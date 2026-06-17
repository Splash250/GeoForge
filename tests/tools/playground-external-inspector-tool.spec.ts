import test, { expect, type Page } from '@playwright/test';
import { waitForMapIdle } from '@tests/utils/basic.ts';
import { setupGeomanTest } from '@tests/utils/test-helpers.ts';

test.describe('Playground external inspector example', () => {
  let page: Page;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    await setupGeomanTest(page);
  });

  test('opens, saves, cancels, and closes an app-owned inspector panel', async ({ page }) => {
    await page.evaluate(() => {
      window.geoman.features.importGeoJsonFeature({
        type: 'Feature',
        id: 'inspector-line',
        properties: { shape: 'line', label: 'Initial label' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 51],
            [1, 51],
          ],
        },
      });
    });
    await waitForMapIdle(page);

    const inspectorControl = page.getByRole('button', { name: 'Feature inspector', exact: true });
    await expect(inspectorControl).toBeVisible();
    await inspectorControl.click();

    await clickFeature(page);
    const panel = page.locator('.gm-external-inspector-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Feature Inspector');
    await expect(panel).toContainText('inspector-line');
    await expect(panel).toContainText('LineString');

    await page.getByRole('textbox', { name: 'Feature label' }).fill('Saved label');
    await page.getByRole('button', { name: 'Save inspector edit' }).click();
    await expect(panel).toHaveCount(0);
    await expect.poll(() => getFeatureLabel(page)).toBe('Saved label');

    await clickFeature(page);
    await expect(panel).toBeVisible();
    await page.getByRole('textbox', { name: 'Feature label' }).fill('Cancelled label');
    await page.getByRole('button', { name: 'Cancel inspector edit' }).click();
    await expect(panel).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Feature label' })).toHaveValue('Saved label');
    await expect.poll(() => getFeatureLabel(page)).toBe('Saved label');

    await page.getByRole('button', { name: 'Close inspector' }).click();
    await expect(panel).toHaveCount(0);
  });
});

async function clickFeature(page: Page) {
  const point = await page.evaluate(() => {
    type ProjectableMap = {
      project(lngLat: [number, number]): { x: number; y: number };
    };
    const map = window.customData!.map as unknown as ProjectableMap;
    const projected = map.project([0.5, 51]);
    return { x: projected.x, y: projected.y };
  });

  await page.mouse.click(point.x, point.y);
}

async function getFeatureLabel(page: Page) {
  return page.evaluate(() => {
    const feature = window.geoman.features.get('gm_main', 'inspector-line');
    return feature?.getGeoJson().properties.label ?? null;
  });
}
