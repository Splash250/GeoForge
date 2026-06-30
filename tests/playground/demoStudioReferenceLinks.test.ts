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
  test('resolves local docs paths to GitHub markdown files', () => {
    expect(resolveDemoDocsUrl(demo({ docsPath: '/docs/html-overlays' }))).toBe(
      'https://github.com/Splash250/GeoForge/blob/main/docs/html-overlays.md',
    );
  });

  test('normalizes docs paths that omit the leading slash to GitHub markdown files', () => {
    expect(resolveDemoDocsUrl(demo({ docsPath: 'docs/decorators' }))).toBe(
      'https://github.com/Splash250/GeoForge/blob/main/docs/decorators.md',
    );
  });

  test('keeps safe external docs URLs', () => {
    expect(resolveDemoDocsUrl(demo({ docsPath: 'https://example.com/docs/decorators' }))).toBe(
      'https://example.com/docs/decorators',
    );
  });

  test('rejects unsafe and protocol-relative docs URLs', () => {
    expect(resolveDemoDocsUrl(demo({ docsPath: 'javascript:alert(1)' }))).toBeNull();
    expect(resolveDemoDocsUrl(demo({ docsPath: 'data:text/html,unsafe' }))).toBeNull();
    expect(resolveDemoDocsUrl(demo({ docsPath: '//example.com/docs/decorators' }))).toBeNull();
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

  test('rejects unsafe explicit GitHub URLs before falling back to source paths', () => {
    expect(
      resolveDemoSourceUrl(
        demo({
          githubUrl: 'javascript:alert(1)',
          sourcePath: 'examples/playground/src/demo-studio/demos/overlays/overlayDemos.ts',
        }),
      ),
    ).toBe(
      'https://github.com/Splash250/GeoForge/blob/main/examples/playground/src/demo-studio/demos/overlays/overlayDemos.ts',
    );

    expect(resolveDemoSourceUrl(demo({ githubUrl: 'data:text/html,unsafe' }))).toBeNull();
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

    expect(openReferenceUrl('https://github.com/Splash250/GeoForge', { open })).toBe(true);
    expect(open).toHaveBeenCalledWith(
      'https://github.com/Splash250/GeoForge',
      '_blank',
      'noopener,noreferrer',
    );
  });

  test('does not open blank or missing URLs', () => {
    const open = vi.fn();

    expect(openReferenceUrl(null, { open })).toBe(false);
    expect(openReferenceUrl('   ', { open })).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  test('does not open unsafe or protocol-relative URLs', () => {
    const open = vi.fn();

    expect(openReferenceUrl('javascript:alert(1)', { open })).toBe(false);
    expect(openReferenceUrl('data:text/html,unsafe', { open })).toBe(false);
    expect(openReferenceUrl('//example.com/docs/decorators', { open })).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });
});
