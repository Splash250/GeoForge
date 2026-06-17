import test, { expect } from '@playwright/test';
import { setupGeomanTest } from '@tests/utils/test-helpers.ts';

test.describe('Controls state isolation', () => {
  test('keeps control styles scoped to each Geoman instance', async ({ page }) => {
    await setupGeomanTest(page);

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
          controlsStyles: {
            controlGroupClass: 'second-control-group',
            controlContainerClass: 'second-control-container',
            controlButtonClass: 'second-control-button',
          },
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

      (window as typeof window & { secondGeoman?: typeof secondGeoman }).secondGeoman =
        secondGeoman;
    });

    const firstMapDrawMarker = page.locator('#dev-map .geoman-controls #id_draw_marker');
    await expect(firstMapDrawMarker).toBeVisible();
    await expect(firstMapDrawMarker).toHaveClass(/gm-control-button/);
    await expect(firstMapDrawMarker).not.toHaveClass(/second-control-button/);

    const secondMapDrawMarker = page.locator('#second-geoman-map .geoman-controls #id_draw_marker');
    await expect(secondMapDrawMarker).toBeVisible();
    await expect(secondMapDrawMarker).toHaveClass(/second-control-button/);
  });
});
