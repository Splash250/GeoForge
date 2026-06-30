import type { RegisteredDemoDefinition } from './types.ts';

export const GEOFORGE_REPOSITORY_URL = 'https://github.com/Splash250/GeoForge';
export const GEOFORGE_DEFAULT_BRANCH = 'main';
export const DEMO_STUDIO_EXAMPLES_SOURCE_PATH = 'examples/playground/src/demo-studio';
export const WINDOW_OPEN_FEATURES = 'noopener,noreferrer';

type GithubBlobOptions = {
  repositoryUrl?: string;
  sourcePath?: string | null;
  branch?: string;
};

type OpenReferenceOptions = {
  open?: (url: string, target: string, features: string) => Window | null | undefined;
};

export function resolveDemoDocsUrl(demo: Pick<RegisteredDemoDefinition, 'docsPath'>) {
  const docsPath = demo.docsPath.trim();

  if (!docsPath) {
    return null;
  }

  if (isAbsoluteUrl(docsPath)) {
    return docsPath;
  }

  return docsPath.startsWith('/') ? docsPath : `/${docsPath}`;
}

export function resolveDemoSourceUrl(
  demo: Pick<RegisteredDemoDefinition, 'githubUrl' | 'sourcePath'>,
) {
  const explicitGithubUrl = demo.githubUrl?.trim();

  if (explicitGithubUrl) {
    return explicitGithubUrl;
  }

  return resolveGithubBlobUrl({
    repositoryUrl: GEOFORGE_REPOSITORY_URL,
    sourcePath: demo.sourcePath,
    branch: GEOFORGE_DEFAULT_BRANCH,
  });
}

export function resolveExamplesSourceUrl() {
  return `${GEOFORGE_REPOSITORY_URL}/tree/${GEOFORGE_DEFAULT_BRANCH}/${DEMO_STUDIO_EXAMPLES_SOURCE_PATH}`;
}

export function resolveGithubBlobUrl({
  repositoryUrl = GEOFORGE_REPOSITORY_URL,
  sourcePath,
  branch = GEOFORGE_DEFAULT_BRANCH,
}: GithubBlobOptions) {
  const normalizedSourcePath = sourcePath?.trim().replace(/^\/+/, '');

  if (!normalizedSourcePath) {
    return null;
  }

  return `${normalizeRepositoryUrl(repositoryUrl)}/blob/${branch}/${normalizedSourcePath}`;
}

export function openReferenceUrl(url: string | null | undefined, options: OpenReferenceOptions = {}) {
  const normalizedUrl = url?.trim();

  if (!normalizedUrl) {
    return false;
  }

  const open = options.open ?? (typeof window === 'undefined' ? undefined : window.open.bind(window));

  if (!open) {
    return false;
  }

  open(normalizedUrl, '_blank', WINDOW_OPEN_FEATURES);
  return true;
}

function normalizeRepositoryUrl(repositoryUrl: string) {
  return repositoryUrl.trim().replace(/\/+$/, '').replace(/\.git$/, '');
}

function isAbsoluteUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
