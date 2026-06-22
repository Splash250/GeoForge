import { drawEditDemos } from '../demos/draw-edit/drawEditDemos.ts';
import { featureDataDemos } from '../demos/feature-data/featureDataDemos.ts';
import { geometryDemos } from '../demos/geometry-tools/geometryDemos.ts';
import { lineDecoratorDemos } from '../demos/line-decorators/lineDecoratorDemos.ts';
import { overlayDemos } from '../demos/overlays/overlayDemos.ts';
import { workflowDemos } from '../demos/workflow-systems/workflowDemos.ts';
import type { DemoCategory } from './types.ts';

export const demoRegistry: DemoCategory[] = [
  {
    id: 'draw-edit',
    title: 'Draw And Edit',
    description: 'Create and modify GeoForge map features with drawing, edit, snapping, and marker helpers.',
    demos: drawEditDemos
  },
  {
    id: 'line-decorators',
    title: 'Line Decorators',
    description: 'Render arrows, labels, symbols, and animated decorations on route and network lines.',
    demos: lineDecoratorDemos
  },
  {
    id: 'overlays',
    title: 'Overlays',
    description: 'Anchor iframe-backed HTML overlays to map coordinates and inspect interaction behavior.',
    demos: overlayDemos
  },
  {
    id: 'feature-data',
    title: 'Feature Data',
    description: 'Import, export, identify, and inspect GeoForge features across package-safe data flows.',
    demos: featureDataDemos
  },
  {
    id: 'geometry-tools',
    title: 'Geometry Tools',
    description: 'Measure, edit, connect, and validate line geometry for serious map editing workflows.',
    demos: geometryDemos
  },
  {
    id: 'workflow-systems',
    title: 'Workflow Systems',
    description: 'Build application workflows with selection, panels, transactions, history, and diagnostics.',
    demos: workflowDemos
  }
];
