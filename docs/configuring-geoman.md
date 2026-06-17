# Configuring Geoman

Geoman accepts a rich configuration object that lets you customize controls, styles, and behavior. Pass the configuration to the `Geoman` constructor to apply your preferred defaults.

## Configuration Structure

```ts
interface GmOptionsData {
  settings: {
    throttlingDelay: number;
    useDefaultLayers: boolean;
    controlsPosition: BaseControlsPosition;
    controlsUiEnabledByDefault: boolean;
    controlsCollapsible: boolean;
    controlsStyles: ControlStyles;
    idGenerator: null | ((shapeGeoJson: GeoJsonShapeFeature) => string);
    markerIcons: {
      default: string;
      control: string;
    };
  };
  layerStyles: Record<
    string,
    {
      gm_main: Array<PartialLayerStyle>;
      gm_temporary: Array<PartialLayerStyle>;
    }
  >;
  controls: {
    draw: Record<DrawModeName, ControlOptions>;
    edit: Record<EditModeName, ControlOptions>;
    helper: Record<HelperModeName, ControlOptions>;
  };
}
```

Use `GmOptionsPartial` to override only the properties you need.

## Basic Usage

```ts
import { Geoman, type GmOptionsPartial } from '@sewergy/maplibre-geoman';

const gmOptions: GmOptionsPartial = {
  settings: {
    controlsPosition: 'top-right',
    throttlingDelay: 100,
  },
  controls: {
    draw: {
      polygon: {
        title: 'Draw Polygon',
        icon: 'custom-polygon-icon',
        uiEnabled: true,
        active: false,
      },
    },
  },
};

const gm = new Geoman(map, gmOptions);
```

## Settings Configuration

```ts
const gmOptions: GmOptionsPartial = {
  settings: {
    // Delay in milliseconds for throttled events
    throttlingDelay: 100,

    // Position of the control panel
    controlsPosition: 'top-right', // 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

    // Control visibility defaults
    controlsUiEnabledByDefault: true,
    controlsCollapsible: false,

    // Override control styling
    controlsStyles: {
      controlGroupClass: 'maplibregl-ctrl maplibregl-ctrl-group',
      controlContainerClass: 'gm-control-container',
      controlButtonClass: 'gm-control-button',
    },

    // Optional feature id generator
    idGenerator: null,

    // Default marker icons
    markerIcons: {
      default: '', // SVG content for default marker
      control: '', // SVG content for control marker
    },
  },
};
```

## Controls Configuration

### Draw Controls

Draw controls manage the creation of new geometries. Implemented draw modes are `marker`, `circle`, `ellipse`, `circle_marker`, `text_marker`, `line`, `rectangle`, and `polygon`. The `freehand` and `custom_shape` keys are reserved in the type surface but do not have runtime mode classes in this package today.

```ts
const gmOptions: GmOptionsPartial = {
  controls: {
    draw: {
      polygon: {
        title: 'Draw Polygon',
        icon: 'custom-polygon-icon',
        uiEnabled: true,
        active: false,
        options: [
          {
            type: 'toggle',
            name: 'snap',
            label: 'Snap to Vertices',
            value: true,
          },
        ],
      },
      line: {
        title: 'Draw Line',
        uiEnabled: true,
        active: false,
      },
    },
  },
};
```

### Edit Controls

Edit controls modify existing geometries. Implemented edit modes are `drag`, `change`, `rotate`, `cut`, and `delete`. The `scale`, `copy`, `split`, `union`, `difference`, `line_simplification`, and `lasso` keys are reserved in the type surface but do not have runtime mode classes in this package today.

```ts
const gmOptions: GmOptionsPartial = {
  controls: {
    edit: {
      drag: {
        title: 'Drag Features',
        icon: 'drag-icon',
        uiEnabled: true,
        active: false,
      },
      rotate: {
        title: 'Rotate Features',
        uiEnabled: true,
        active: false,
        options: [
          {
            type: 'select',
            name: 'rotationStep',
            label: 'Rotation Step',
            value: { title: '45 deg', value: 45 },
            choices: [
              { title: '15 deg', value: 15 },
              { title: '45 deg', value: 45 },
              { title: '90 deg', value: 90 },
            ],
          },
        ],
      },
    },
  },
};
```

### Helper Controls

Helper controls provide auxiliary functionality. Implemented helper modes are `shape_markers`, `snapping`, `zoom_to_features`, and `click_to_edit`. The `pin`, `snap_guides`, `measurements`, `auto_trace`, and `geofencing` keys are reserved in the type surface but do not have runtime mode classes in this package today.

```ts
const gmOptions: GmOptionsPartial = {
  controls: {
    helper: {
      snapping: {
        title: 'Snap to Features',
        uiEnabled: true,
        active: true,
        options: [
          {
            type: 'toggle',
            name: 'snapToVertices',
            label: 'Snap to Vertices',
            value: true,
          },
        ],
      },
      zoom_to_features: {
        title: 'Zoom to Features',
        uiEnabled: true,
        active: false,
      },
    },
  },
};
```

## Layer Styles Configuration

Geoman uses the Mapbox/MapLibre style specification. Each shape can define multiple layer styles using two categories:

- `gm_main`: default styles for static rendering.
- `gm_temporary`: override styles applied while editing or drawing.

```ts
layerStyles: {
  [shapeType: string]: {
    gm_main: Array<PartialLayerStyle>;
    gm_temporary: Array<PartialLayerStyle>;
  };
}
```

### Available Shape Types

- `marker`
- `circle`
- `ellipse`
- `circle_marker`
- `text_marker`
- `line`
- `rectangle`
- `polygon`

### Layer Style Types

**Symbol layer** (markers and text):

```ts
interface PartialSymbolLayer {
  type: 'symbol';
  layout?: {
    'icon-image'?: string;
    'icon-size'?: number;
    'icon-allow-overlap'?: boolean;
    'icon-anchor'?:
      | 'center'
      | 'left'
      | 'right'
      | 'top'
      | 'bottom'
      | 'top-left'
      | 'top-right'
      | 'bottom-left'
      | 'bottom-right';
    'text-field'?: string[];
    'text-size'?: number;
    'text-justify'?: 'auto' | 'left' | 'center' | 'right';
    'text-anchor'?:
      | 'center'
      | 'left'
      | 'right'
      | 'top'
      | 'bottom'
      | 'top-left'
      | 'top-right'
      | 'bottom-left'
      | 'bottom-right';
  };
  paint?: {
    'text-color'?: string;
    'text-opacity'?: number;
    'text-halo-color'?: string;
    'text-halo-width'?: number;
  };
}
```

**Line layer** (lines and polygon outlines):

```ts
interface PartialLineLayer {
  type: 'line';
  paint?: {
    'line-color'?: string;
    'line-width'?: number;
    'line-opacity'?: number;
    'line-dasharray'?: number[];
  };
  layout?: {
    'line-cap'?: 'butt' | 'round' | 'square';
    'line-join'?: 'bevel' | 'round' | 'miter';
  };
}
```

**Fill layer** (polygons):

```ts
interface PartialFillLayer {
  type: 'fill';
  paint?: {
    'fill-color'?: string;
    'fill-opacity'?: number;
    'fill-outline-color'?: string;
    'fill-antialias'?: boolean;
  };
}
```

**Circle layer** (circle markers):

```ts
interface PartialCircleLayer {
  type: 'circle';
  paint?: {
    'circle-radius'?: number;
    'circle-color'?: string;
    'circle-opacity'?: number;
    'circle-stroke-width'?: number;
    'circle-stroke-color'?: string;
    'circle-stroke-opacity'?: number;
  };
}
```

### Comprehensive Example

```ts
const gmOptions: GmOptionsPartial = {
  layerStyles: {
    marker: {
      gm_main: [
        {
          type: 'symbol',
          layout: {
            'icon-image': 'default-marker',
            'icon-size': 0.25,
            'icon-allow-overlap': true,
            'icon-anchor': 'bottom',
          },
        },
      ],
      gm_temporary: [
        {
          type: 'symbol',
          layout: {
            'icon-image': 'temp-marker',
            'icon-size': 0.25,
          },
        },
      ],
    },
    text_marker: {
      gm_main: [
        {
          type: 'symbol',
          layout: {
            'text-field': ['get', 'text'],
            'text-size': 32,
            'text-justify': 'center',
            'text-anchor': 'center',
          },
          paint: {
            'text-color': '#333333',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2,
          },
        },
      ],
    },
    line: {
      gm_main: [
        {
          type: 'line',
          paint: {
            'line-color': '#3388ff',
            'line-width': 3,
            'line-opacity': 0.7,
          },
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
        },
      ],
      gm_temporary: [
        {
          type: 'line',
          paint: {
            'line-color': '#ff3388',
            'line-width': 3,
            'line-opacity': 0.7,
            'line-dasharray': [2, 2],
          },
        },
      ],
    },
    polygon: {
      gm_main: [
        {
          type: 'fill',
          paint: {
            'fill-color': '#3388ff',
            'fill-opacity': 0.2,
            'fill-outline-color': '#3388ff',
          },
        },
        {
          type: 'line',
          paint: {
            'line-color': '#3388ff',
            'line-width': 2,
            'line-opacity': 0.7,
          },
        },
      ],
      gm_temporary: [
        {
          type: 'fill',
          paint: {
            'fill-color': '#ff3388',
            'fill-opacity': 0.2,
            'fill-outline-color': '#ff3388',
          },
        },
        {
          type: 'line',
          paint: {
            'line-color': '#ff3388',
            'line-width': 2,
            'line-opacity': 0.7,
            'line-dasharray': [2, 2],
          },
        },
      ],
    },
  },
};
```

### Notes

- Layer order matters. For polygons define fill before outline layers.
- If `gm_temporary` is omitted the temporary style falls back to `gm_main`.
- Load custom marker icons before referencing them in styles.
- MapLibre expressions work for dynamic styling based on feature properties.
- Use simpler `gm_temporary` styles to keep editing responsive.

## Control Options

Each control shares a common interface:

```ts
interface ControlOptions {
  title: string;
  icon: string | null;
  uiEnabled: boolean;
  active: boolean;
  options?: ActionOptions;
}
```

### Action Option Types

```ts
type SelectActionOption = {
  type: 'select';
  label: string;
  name: string;
  value: { title: string; value: boolean | string | number };
  choices: Array<{ title: string; value: boolean | string | number }>;
};

type ToggleActionOption = {
  type: 'toggle';
  label: string;
  name: string;
  value: boolean;
};
```

## Full Configuration Example

```ts
const gmOptions: GmOptionsPartial = {
  settings: {
    controlsPosition: 'top-right',
    throttlingDelay: 100,
  },
  controls: {
    draw: {
      polygon: {
        title: 'Draw Polygon',
        icon: 'polygon-icon',
        uiEnabled: true,
        active: false,
        options: [
          {
            type: 'toggle',
            name: 'snap',
            label: 'Snap to Vertices',
            value: true,
          },
        ],
      },
    },
    edit: {
      rotate: {
        title: 'Rotate Features',
        uiEnabled: true,
        active: false,
      },
    },
    helper: {
      snapping: {
        title: 'Snap to Features',
        uiEnabled: true,
        active: true,
      },
    },
  },
  layerStyles: {
    polygon: {
      gm_main: [
        {
          type: 'fill',
          paint: {
            'fill-color': '#3388ff',
            'fill-opacity': 0.2,
            'fill-outline-color': '#3388ff',
          },
        },
      ],
    },
  },
};

const gm = new Geoman(map, gmOptions);
```

This configuration combines custom controls, styles, and settings. Because everything is a partial, you can override only what you need and rely on sensible defaults for the rest.
