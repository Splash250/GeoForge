import test, { expect, type Page } from '@playwright/test';
import { waitForGeoman } from '@tests/utils/basic.ts';

const getHistorySmokeState = async (page: Page) => {
  return page.evaluate(async () => {
    const geoman = window.geoman;
    if (!geoman) {
      throw new Error('Geoman is not available');
    }

    await geoman.features.updateManager.waitForPendingUpdates('gm_main');

    return {
      hasFeature: geoman.features.has('gm_main', 'history-smoke-feature'),
      history: geoman.history.getState(),
    };
  });
};

const getHistoryEditState = async (page: Page) => {
  return page.evaluate(async () => {
    const geoman = window.geoman;
    if (!geoman) {
      throw new Error('Geoman is not available');
    }

    await geoman.features.updateManager.waitForPendingUpdates('gm_main');
    const feature = geoman.features.get('gm_main', 'history-edit-feature');

    return {
      segmentValue: feature?.getProperty('segmentValue'),
      label: feature?.getProperty('label'),
      history: geoman.history.getState(),
    };
  });
};

test.describe('Generic history undo/redo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGeoman(page);
  });

  test('undoes and redoes a committed feature creation', async ({ page }) => {
    await page.evaluate(() => {
      window.geoman?.history.clear();
      window.geoman?.features.createFeature({
        featureId: 'history-smoke-feature',
        sourceName: 'gm_main',
        shapeGeoJson: {
          type: 'Feature',
          properties: { shape: 'marker', label: 'History smoke' },
          geometry: { type: 'Point', coordinates: [0, 0] },
        },
      });
    });

    let state = await getHistorySmokeState(page);
    expect(state.hasFeature).toBe(true);
    expect(state.history.canUndo).toBe(true);
    expect(state.history.canRedo).toBe(false);

    await page.evaluate(() => window.geoman?.history.undo());

    state = await getHistorySmokeState(page);
    expect(state.hasFeature).toBe(false);
    expect(state.history.canUndo).toBe(false);
    expect(state.history.canRedo).toBe(true);

    await page.evaluate(() => window.geoman?.history.redo());

    state = await getHistorySmokeState(page);
    expect(state.hasFeature).toBe(true);
    expect(state.history.canUndo).toBe(true);
    expect(state.history.canRedo).toBe(false);
  });

  test('undoes and redoes a committed transaction-backed feature edit', async ({ page }) => {
    await page.evaluate(() => {
      const geoman = window.geoman;
      if (!geoman) {
        throw new Error('Geoman is not available');
      }

      geoman.features.createFeature({
        featureId: 'history-edit-feature',
        sourceName: 'gm_main',
        shapeGeoJson: {
          type: 'Feature',
          properties: { shape: 'marker', segmentValue: 100 },
          geometry: { type: 'Point', coordinates: [0, 0] },
        },
      });
      geoman.history.clear();

      const transaction = geoman.transactions.start({ id: 'history-edit-browser-proof' });
      const feature = geoman.features.get('gm_main', 'history-edit-feature');
      if (!feature) {
        throw new Error('Feature was not created');
      }

      transaction.updateProperties(feature, { segmentValue: 250, label: 'Edited' });
      const result = transaction.commit();
      if (!result.committed) {
        throw new Error(result.messages.join(', '));
      }
    });

    let state = await getHistoryEditState(page);
    expect(state.segmentValue).toBe(250);
    expect(state.label).toBe('Edited');
    expect(state.history.canUndo).toBe(true);
    expect(state.history.canRedo).toBe(false);

    await page.evaluate(() => window.geoman?.history.undo());

    state = await getHistoryEditState(page);
    expect(state.segmentValue).toBe(100);
    expect(state.label).toBeUndefined();
    expect(state.history.canUndo).toBe(false);
    expect(state.history.canRedo).toBe(true);

    await page.evaluate(() => window.geoman?.history.redo());

    state = await getHistoryEditState(page);
    expect(state.segmentValue).toBe(250);
    expect(state.label).toBe('Edited');
    expect(state.history.canUndo).toBe(true);
    expect(state.history.canRedo).toBe(false);
  });

});
