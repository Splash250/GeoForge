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

  const safeAbsoluteUrl = parseSafeAbsoluteUrl(docsPath);

  if (safeAbsoluteUrl) {
    return safeAbsoluteUrl;
  }

  if (isUnsafeAbsoluteOrProtocolRelativeUrl(docsPath)) {
    return null;
  }

  return resolveGithubBlobUrl({
    repositoryUrl: GEOFORGE_REPOSITORY_URL,
    sourcePath: resolveDocsSourcePath(docsPath),
    branch: GEOFORGE_DEFAULT_BRANCH,
  });
}

export function resolveDemoSourceUrl(
  demo: Pick<RegisteredDemoDefinition, 'githubUrl' | 'sourcePath'>,
) {
  const explicitGithubUrl = demo.githubUrl ? parseSafeAbsoluteUrl(demo.githubUrl) : null;

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
  const normalizedUrl = url ? parseSafeAbsoluteUrl(url) : null;

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

function resolveDocsSourcePath(docsPath: string) {
  const normalizedPath = docsPath
    .trim()
    .replace(/^\/+/, '')
    .replace(/^docs\/?/, 'docs/')
    .replace(/\.md$/, '');

  return `${normalizedPath}.md`;
}

function parseSafeAbsoluteUrl(value: string) {
  try {
    const normalizedValue = value.trim();
    const url = new URL(normalizedValue);
    return url.protocol === 'http:' || url.protocol === 'https:' ? normalizedValue : null;
  } catch {
    return null;
  }
}

function isUnsafeAbsoluteOrProtocolRelativeUrl(value: string) {
  return value.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(value);
}
