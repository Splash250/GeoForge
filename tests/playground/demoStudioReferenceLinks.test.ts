import { describe, expect, test, vi } from 'vitest';
import {
  DEMO_STUDIO_EXAMPLES_SOURCE_PATH,
  GEOFORGE_REPOSITORY_URL,
  openReferenceUrl,
  resolveDemoDocsUrl,
  resolveDemoSourceUrl,
  resolveExamplesSourceUrl,
  resolveGithubBlobUrl,
} from '../../examples/playground/src/demo-studio/registry/referenceLinks.ts';
import type { RegisteredDemoDefinition } from '../../examples/playground/src/demo-studio/registry/types.ts';

function demo(metadata: Partial<RegisteredDemoDefinition>): RegisteredDemoDefinition {
  return metadata as RegisteredDemoDefinition;
}

describe('Demo Studio reference links', () => {
  test('resolves local docs paths as app URLs', () => {
    expect(resolveDemoDocsUrl(demo({ docsPath: '/docs/html-overlays' }))).toBe(
      '/docs/html-overlays',
    );
  });

  test('normalizes docs paths that omit the leading slash', () => {
    expect(resolveDemoDocsUrl(demo({ docsPath: 'docs/decorators' }))).toBe('/docs/decorators');
  });

  test('uses explicit GitHub URLs before source paths', () => {
    const githubUrl = 'https://github.com/Splash250/GeoForge/blob/codex/demo/example.ts';

    expect(
      resolveDemoSourceUrl(
        demo({
          githubUrl,
          sourcePath: 'examples/playground/src/demo-studio/demos/overlays/overlayDemos.ts',
        }),
      ),
    ).toBe(githubUrl);
  });

  test('resolves source paths to main branch GitHub blob URLs', () => {
    expect(
      resolveDemoSourceUrl(
        demo({
          sourcePath: 'examples/playground/src/demo-studio/demos/overlays/overlayDemos.ts',
        }),
      ),
    ).toBe(
      'https://github.com/Splash250/GeoForge/blob/main/examples/playground/src/demo-studio/demos/overlays/overlayDemos.ts',
    );
  });

  test('returns null when source metadata is missing', () => {
    expect(resolveDemoSourceUrl(demo({ docsPath: '/docs/html-overlays' }))).toBeNull();
  });

  test('normalizes repository URLs before building blob links', () => {
    expect(
      resolveGithubBlobUrl({
        repositoryUrl: 'https://github.com/Splash250/GeoForge.git/',
        sourcePath: '/examples/playground/src/demo-studio/registry/demoRegistry.ts',
        branch: 'codex/demo-studio-shell-links',
      }),
    ).toBe(
      'https://github.com/Splash250/GeoForge/blob/codex/demo-studio-shell-links/examples/playground/src/demo-studio/registry/demoRegistry.ts',
    );
  });

  test('resolves the examples action to the Demo Studio registry source directory', () => {
    expect(resolveExamplesSourceUrl()).toBe(
      `${GEOFORGE_REPOSITORY_URL}/tree/main/${DEMO_STUDIO_EXAMPLES_SOURCE_PATH}`,
    );
  });

  test('opens resolved URLs in a new tab with noopener and noreferrer', () => {
    const open = vi.fn();

    expect(openReferenceUrl('/docs/html-overlays', { open })).toBe(true);
    expect(open).toHaveBeenCalledWith('/docs/html-overlays', '_blank', 'noopener,noreferrer');
  });

  test('does not open blank or missing URLs', () => {
    const open = vi.fn();

    expect(openReferenceUrl(null, { open })).toBe(false);
    expect(openReferenceUrl('   ', { open })).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });
});
