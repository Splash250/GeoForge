import { FEATURE_ID_PROPERTY, SOURCES } from '@/core/features/constants.ts';
import type { FeatureId } from '@/types/features.ts';
import type { Geoman } from '@/main.ts';
import type { SelectionLayerStyleOptions, SelectionStyle } from './types.ts';
import type { AddLayerObject, FilterSpecification, Map } from 'maplibre-gl';

type SelectionLayerState = {
  hoveredFeatureId: FeatureId | null;
  selectedFeatureId: FeatureId | null;
};

type SelectionStateName = 'hover' | 'selected';
type SelectionGeometryName = 'fill' | 'line' | 'circle';

type SelectionLayerDefinition = {
  id: string;
  state: SelectionStateName;
  geometry: SelectionGeometryName;
};

type CompleteSelectionStyle = Required<SelectionStyle>;

const EMPTY_FEATURE_ID = '__geoman_selection_no_feature__';

const DEFAULT_STYLES: Record<SelectionStateName, CompleteSelectionStyle> = {
  hover: {
    lineColor: '#0ea5e9',
    lineWidth: 7,
    lineOpacity: 0.45,
    fillColor: '#0ea5e9',
    fillOpacity: 0.12,
    circleRadius: 10,
    circleColor: '#0ea5e9',
    circleStrokeColor: '#ffffff',
    circleStrokeWidth: 2,
  },
  selected: {
    lineColor: '#db2777',
    lineWidth: 8,
    lineOpacity: 0.7,
    fillColor: '#db2777',
    fillOpacity: 0.18,
    circleRadius: 11,
    circleColor: '#db2777',
    circleStrokeColor: '#ffffff',
    circleStrokeWidth: 2,
  },
};

export class SelectionLayerManager {
  private styles: Record<SelectionStateName, CompleteSelectionStyle> = DEFAULT_STYLES;
  private layersCreated = false;
  private lastHoveredFeatureId: FeatureId | null | undefined;
  private lastSelectedFeatureId: FeatureId | null | undefined;
  private readonly layerDefinitions: SelectionLayerDefinition[] = [
    { id: `${SOURCES.main}__selection_hover_fill`, state: 'hover', geometry: 'fill' },
    { id: `${SOURCES.main}__selection_hover_line`, state: 'hover', geometry: 'line' },
    { id: `${SOURCES.main}__selection_hover_circle`, state: 'hover', geometry: 'circle' },
    { id: `${SOURCES.main}__selection_selected_fill`, state: 'selected', geometry: 'fill' },
    { id: `${SOURCES.main}__selection_selected_line`, state: 'selected', geometry: 'line' },
    { id: `${SOURCES.main}__selection_selected_circle`, state: 'selected', geometry: 'circle' },
  ];

  constructor(
    private readonly options: {
      geoman: Geoman;
    },
  ) {}

  configure(styles: SelectionLayerStyleOptions = {}) {
    this.styles = {
      hover: { ...this.styles.hover, ...styles.hover },
      selected: { ...this.styles.selected, ...styles.selected },
    };

    if (this.layersCreated) {
      this.layerDefinitions.forEach((definition) => {
        this.applyPaint(definition);
      });
    }
  }

  update(state: SelectionLayerState) {
    if (!this.getMap()) {
      return;
    }

    this.ensureLayers();

    if (this.lastHoveredFeatureId !== state.hoveredFeatureId) {
      this.updateLayerGroup('hover', state.hoveredFeatureId);
      this.lastHoveredFeatureId = state.hoveredFeatureId;
    }

    if (this.lastSelectedFeatureId !== state.selectedFeatureId) {
      this.updateLayerGroup('selected', state.selectedFeatureId);
      this.lastSelectedFeatureId = state.selectedFeatureId;
    }
  }

  destroy() {
    const map = this.getMap();
    if (!map) {
      return;
    }

    this.layerDefinitions
      .slice()
      .reverse()
      .forEach(({ id }) => {
        if (map.getLayer(id)) {
          map.removeLayer(id);
        }
      });
    this.layersCreated = false;
    this.lastHoveredFeatureId = undefined;
    this.lastSelectedFeatureId = undefined;
  }

  private updateLayerGroup(state: SelectionStateName, featureId: FeatureId | null) {
    const map = this.getMap();
    if (!map) {
      return;
    }

    this.layerDefinitions
      .filter((definition) => definition.state === state)
      .forEach((definition) => {
        map.setFilter(definition.id, this.getLayerFilter(definition.geometry, featureId));
      });
  }

  private ensureLayers() {
    const map = this.getMap();
    if (this.layersCreated || !map) {
      return;
    }

    this.layerDefinitions.forEach((definition) => {
      if (!map.getLayer(definition.id)) {
        map.addLayer(this.getLayerOptions(definition));
      }
    });
    this.layersCreated = true;
  }

  private getLayerOptions(definition: SelectionLayerDefinition): AddLayerObject {
    const style = this.styles[definition.state];
    const base = {
      id: definition.id,
      source: SOURCES.main,
      filter: this.getLayerFilter(definition.geometry, null),
    };

    if (definition.geometry === 'fill') {
      return {
        ...base,
        type: 'fill',
        paint: {
          'fill-color': style.fillColor,
          'fill-opacity': style.fillOpacity,
        },
      };
    }

    if (definition.geometry === 'circle') {
      return {
        ...base,
        type: 'circle',
        paint: {
          'circle-radius': style.circleRadius,
          'circle-color': style.circleColor,
          'circle-stroke-color': style.circleStrokeColor,
          'circle-stroke-width': style.circleStrokeWidth,
        },
      };
    }

    return {
      ...base,
      type: 'line',
      paint: {
        'line-color': style.lineColor,
        'line-width': style.lineWidth,
        'line-opacity': style.lineOpacity,
      },
    };
  }

  private applyPaint(definition: SelectionLayerDefinition) {
    const map = this.getMap();
    if (!map?.getLayer(definition.id)) {
      return;
    }

    const style = this.styles[definition.state];
    if (definition.geometry === 'fill') {
      this.setPaintProperties(definition.id, {
        'fill-color': style.fillColor,
        'fill-opacity': style.fillOpacity,
      });
      return;
    }

    if (definition.geometry === 'circle') {
      this.setPaintProperties(definition.id, {
        'circle-radius': style.circleRadius,
        'circle-color': style.circleColor,
        'circle-stroke-color': style.circleStrokeColor,
        'circle-stroke-width': style.circleStrokeWidth,
      });
      return;
    }

    this.setPaintProperties(definition.id, {
      'line-color': style.lineColor,
      'line-width': style.lineWidth,
      'line-opacity': style.lineOpacity,
    });
  }

  private setPaintProperties(layerId: string, properties: Record<string, string | number>) {
    const map = this.getMap();
    if (!map) {
      return;
    }

    Object.entries(properties).forEach(([name, value]) => {
      map.setPaintProperty(layerId, name, value);
    });
  }

  private getLayerFilter(
    geometry: SelectionGeometryName,
    featureId: FeatureId | null,
  ): FilterSpecification {
    const idFilter: FilterSpecification = [
      '==',
      ['get', FEATURE_ID_PROPERTY],
      featureId ?? EMPTY_FEATURE_ID,
    ];

    if (geometry === 'fill') {
      return [
        'all',
        idFilter,
        ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
      ];
    }

    if (geometry === 'circle') {
      return [
        'all',
        idFilter,
        ['any', ['==', ['geometry-type'], 'Point'], ['==', ['geometry-type'], 'MultiPoint']],
      ];
    }

    return [
      'all',
      idFilter,
      [
        'any',
        ['==', ['geometry-type'], 'LineString'],
        ['==', ['geometry-type'], 'MultiLineString'],
        ['==', ['geometry-type'], 'Polygon'],
        ['==', ['geometry-type'], 'MultiPolygon'],
      ],
    ];
  }

  private getMap(): Map | null {
    return this.options.geoman.mapAdapterInstance?.getMapInstance() as Map | null;
  }
}
