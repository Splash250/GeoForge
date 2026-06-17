import test, { expect, type Page } from '@playwright/test';
import { setupGeomanTest } from '@tests/utils/test-helpers.ts';

test.describe('Custom tool controls', () => {
  let page: Page;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    await setupGeomanTest(page);
  });

  test('renders a toggle control that activates and deactivates a custom tool', async () => {
    await page.evaluate(() => {
      window.geoman.tools.register({
        id: 'inspect-feature',
        title: 'Inspect',
        control: {
          title: 'Inspect',
          eventType: 'toggle',
        },
      });
    });

    const inspectControl = page.getByRole('button', { name: 'Inspect', exact: true });
    await expect(inspectControl).toBeVisible();

    await inspectControl.click();
    await expect(inspectControl).toHaveClass(/active/);
    await expect
      .poll(() => page.evaluate(() => window.geoman.tools.getActiveToolId()))
      .toBe('inspect-feature');

    await inspectControl.click();
    await expect(inspectControl).not.toHaveClass(/active/);
    await expect.poll(() => page.evaluate(() => window.geoman.tools.getActiveToolId())).toBeNull();
  });

  test('keeps click controls active until another tool or explicit deactivation changes state', async () => {
    await page.evaluate(() => {
      (window as typeof window & { customToolStartCount: number }).customToolStartCount = 0;
      window.geoman.tools.register({
        id: 'ping-feature',
        title: 'Ping',
        control: {
          title: 'Ping',
          eventType: 'click',
        },
        onStart: () => {
          (window as typeof window & { customToolStartCount: number }).customToolStartCount += 1;
        },
      });
    });

    const pingControl = page.getByRole('button', { name: 'Ping', exact: true });
    await expect(pingControl).toBeVisible();

    await pingControl.click();
    await pingControl.click();

    await expect
      .poll(() => page.evaluate(() => window.geoman.tools.getActiveToolId()))
      .toBe('ping-feature');
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as typeof window & { customToolStartCount: number }).customToolStartCount,
        ),
      )
      .toBe(1);
  });

  test('does not render hidden controls while the tool remains programmatically usable', async () => {
    await page.evaluate(() => {
      window.geoman.tools.register({
        id: 'hidden-feature-tool',
        title: 'Hidden Feature Tool',
        control: {
          title: 'Hidden Feature Tool',
          uiEnabled: false,
        },
      });
    });

    await expect(page.getByRole('button', { name: 'Hidden Feature Tool' })).toHaveCount(0);

    await page.evaluate(() => {
      window.geoman.tools.activate('hidden-feature-tool');
    });

    await expect
      .poll(() => page.evaluate(() => window.geoman.tools.getActiveToolId()))
      .toBe('hidden-feature-tool');
  });
});
