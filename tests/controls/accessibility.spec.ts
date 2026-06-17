import test, { expect, type Page } from '@playwright/test';
import { setupGeomanTest } from '@tests/utils/test-helpers.ts';

const setupSecondCollapsibleGeoman = async (page: Page) => {
  await page.evaluate(async () => {
    const container = document.createElement('div');
    container.id = 'second-geoman-map';
    container.style.position = 'absolute';
    container.style.left = '-10000px';
    container.style.top = '0';
    container.style.width = '320px';
    container.style.height = '240px';
    document.body.appendChild(container);

    const MapCtor = window.mapInstance.constructor as new (options: {
      container: HTMLElement;
      style: {
        version: 8;
        glyphs: string;
        sources: Record<string, never>;
        layers: [];
      };
      center: [number, number];
      zoom: number;
      fadeDuration: number;
    }) => typeof window.mapInstance;

    const secondMap = new MapCtor({
      container,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {},
        layers: [],
      },
      center: [0, 51],
      zoom: 5,
      fadeDuration: 50,
    });

    await new Promise<void>((resolve) => {
      secondMap.once('load', () => resolve());
    });

    const secondGeoman = new window.GeomanClass(secondMap, {
      settings: {
        controlsCollapsible: true,
      },
    });

    await new Promise<void>((resolve, reject) => {
      const startedAt = Date.now();
      const waitForSecondGeoman = () => {
        if (secondGeoman.loaded) {
          resolve();
          return;
        }

        if (Date.now() - startedAt > 10000) {
          reject(new Error('Timed out waiting for second Geoman instance to load'));
          return;
        }

        window.setTimeout(waitForSecondGeoman, 25);
      };

      waitForSecondGeoman();
    });

    (window as typeof window & { secondGeoman?: typeof secondGeoman }).secondGeoman = secondGeoman;
  });
};

test.describe('Controls accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await setupGeomanTest(page);
  });

  test('labels system action controls and exposes pressed and expanded state', async ({ page }) => {
    const markerButton = page.getByRole('button', { name: 'Marker', exact: true });
    await expect(markerButton).toBeVisible();
    await expect(markerButton).toHaveAttribute('aria-label', 'Marker');
    await expect(markerButton).toHaveAttribute('aria-pressed', 'false');
    await expect(markerButton).toHaveAttribute('aria-expanded', 'false');

    await markerButton.click();
    await expect(markerButton).toHaveAttribute('aria-pressed', 'true');
    await expect(markerButton).toHaveAttribute('aria-expanded', 'true');

    await markerButton.click();
    await expect(markerButton).toHaveAttribute('aria-pressed', 'false');
    await expect(markerButton).toHaveAttribute('aria-expanded', 'false');
  });

  test('does not expose pressed state for click-only system action controls', async ({ page }) => {
    const zoomToFeaturesButton = page.getByRole('button', {
      name: 'Zoom to features',
      exact: true,
    });

    await expect(zoomToFeaturesButton).toBeVisible();
    await expect(zoomToFeaturesButton).toHaveAttribute('aria-label', 'Zoom to features');
    await expect(zoomToFeaturesButton).not.toHaveAttribute('aria-pressed', /.*/);
  });

  test('keeps toggle tool controls labeled with pressed state', async ({ page }) => {
    await page.evaluate(() => {
      window.geoman.tools.register({
        id: 'inspect-accessibility',
        title: 'Inspect accessibility',
        control: {
          title: 'Inspect accessibility',
          eventType: 'toggle',
        },
      });
    });

    const inspectControl = page.getByRole('button', {
      name: 'Inspect accessibility',
      exact: true,
    });
    await expect(inspectControl).toBeVisible();
    await expect(inspectControl).toHaveAttribute('aria-label', 'Inspect accessibility');
    await expect(inspectControl).toHaveAttribute('aria-pressed', 'false');

    await inspectControl.click();
    await expect(inspectControl).toHaveAttribute('aria-pressed', 'true');
  });

  test('labels collapsible controls toggle and exposes expanded state', async ({ page }) => {
    await setupSecondCollapsibleGeoman(page);

    const collapseButton = page
      .locator('#second-geoman-map .geoman-controls')
      .getByRole('button', { name: 'Hide Geoman controls', exact: true });
    await expect(collapseButton).toBeVisible();
    await expect(collapseButton).toHaveAttribute('aria-label', 'Hide Geoman controls');
    await expect(collapseButton).toHaveAttribute('aria-expanded', 'true');

    await collapseButton.evaluate((button) => {
      (button as HTMLButtonElement).click();
    });

    const expandButton = page
      .locator('#second-geoman-map .geoman-controls')
      .getByRole('button', { name: 'Show Geoman controls', exact: true });
    await expect(expandButton).toBeVisible();
    await expect(expandButton).toHaveAttribute('aria-label', 'Show Geoman controls');
    await expect(expandButton).toHaveAttribute('aria-expanded', 'false');
  });
});
