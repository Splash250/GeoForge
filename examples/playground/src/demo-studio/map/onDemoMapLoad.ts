type DemoMapLoadTarget = {
  loaded(): boolean;
  once(type: 'load', listener: () => void): unknown;
  off(type: 'load', listener: () => void): unknown;
};

export function onDemoMapLoad(map: DemoMapLoadTarget, callback: () => void) {
  if (map.loaded()) {
    callback();
    return () => {};
  }

  let cleanedUp = false;

  const cleanup = () => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;
    map.off('load', handleLoad);
  };

  const handleLoad = () => {
    if (cleanedUp) {
      return;
    }

    cleanup();
    callback();
  };

  map.once('load', handleLoad);

  if (map.loaded()) {
    handleLoad();
  }

  return cleanup;
}
