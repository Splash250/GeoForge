import './styles.css';

type RouteFamily = 'control-board' | 'demo-studio' | 'legacy';
type RouteCleanup = () => void;

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
    const { startControlBoard } = await import('./routes/control-board');

    if (startId !== routeStartId || route !== resolveRouteFamily()) {
      return;
    }

    currentCleanup = startControlBoard(app);
    return;
  }

  if (route === 'demo-studio') {
    const { startDemoStudio } = await import('./routes/demo-studio');

    if (startId !== routeStartId || route !== resolveRouteFamily()) {
      return;
    }

    currentCleanup = startDemoStudio(app);
    return;
  }

  const { startLegacyPlayground } = await import('./routes/legacy-playground');

  if (startId !== routeStartId || route !== resolveRouteFamily()) {
    return;
  }

  currentCleanup = startLegacyPlayground(app);
}

function resolveRouteFamily(): RouteFamily {
  if (window.location.hash === '#control-board') {
    return 'control-board';
  }

  if (window.location.hash === '#demo-studio') {
    return 'demo-studio';
  }

  return 'legacy';
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }

  return element;
}
