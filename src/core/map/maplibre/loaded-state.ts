type MaplibreLoadedState = {
  loaded?: () => boolean;
  _loaded?: boolean;
};

export function isMaplibreMapLoaded(map: MaplibreLoadedState): boolean {
  if (typeof map.loaded === 'function') {
    return map.loaded() || map._loaded === true;
  }

  return map._loaded === true;
}
