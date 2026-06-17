import { useEffect, useMemo, useRef } from 'react';
import type { Map } from 'maplibre-gl';
import type { LineString, MultiLineString } from 'geojson';
import { ArrowheadManager } from '../map/index.ts';
import type { ArrowheadOptions } from '../types.ts';

export type UseArrowheadsOptions = {
  map: Map | null;
  line: LineString | MultiLineString | null;
  arrowheadOptions?: ArrowheadOptions;
  enabled?: boolean;
};

export function useArrowheads({
  map,
  line,
  arrowheadOptions,
  enabled = true,
}: UseArrowheadsOptions) {
  const managerRef = useRef<ArrowheadManager | null>(null);

  const normalizedOptions = useMemo(() => arrowheadOptions ?? {}, [arrowheadOptions]);

  useEffect(() => {
    if (!map || !enabled) {
      managerRef.current = null;
      return;
    }

    if (!managerRef.current) {
      managerRef.current = new ArrowheadManager({ map });
    }

    return () => {
      managerRef.current?.destroy();
      managerRef.current = null;
    };
  }, [map, enabled]);

  useEffect(() => {
    if (!enabled) {
      managerRef.current?.destroy();
      managerRef.current = null;
      return;
    }
    if (!map) {
      managerRef.current?.destroy();
      managerRef.current = null;
      return;
    }

    if (!managerRef.current) {
      managerRef.current = new ArrowheadManager({ map });
    }

    if (!line) {
      managerRef.current?.clear();
      return;
    }

    managerRef.current?.update(line, normalizedOptions);
  }, [map, enabled, line, normalizedOptions]);
}
