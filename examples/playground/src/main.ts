import './styles.css';

type RouteFamily = 'control-board' | 'demo-studio';
type RouteCleanup = () => void;

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  startPlayground();
}

function startPlayground() {
  const app = requireElement<HTMLDivElement>('#app');

  let currentRoute: RouteFamily | null = null;
  let currentCleanup: RouteCleanup | null = null;
  let routeStartId = 0;

  window.addEventListener('hashchange', () => {
    void startRoute();
  });

  void startRoute();

  async function startRoute() {
    const route = resolveRouteFamily();

    if (route === currentRoute) {
      return;
    }

    const startId = ++routeStartId;
    const cleanup = currentCleanup;
    currentRoute = route;
    currentCleanup = null;
    cleanup?.();

    if (route === 'control-board') {
      const { startControlBoard } = await import('./routes/control-board.ts');

      if (startId !== routeStartId || route !== resolveRouteFamily()) {
        return;
      }

      currentCleanup = startControlBoard(app);
      return;
    }

    const { startDemoStudio } = await import('./routes/demo-studio.ts');

    if (startId !== routeStartId || route !== resolveRouteFamily()) {
      return;
    }

    currentCleanup = startDemoStudio(app);
  }
}

export function resolveRouteFamilyFromHash(hash: string): RouteFamily {
  if (hash === '#control-board') {
    return 'control-board';
  }

  return 'demo-studio';
}

function resolveRouteFamily(): RouteFamily {
  return resolveRouteFamilyFromHash(window.location.hash);
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }

  return element;
}
