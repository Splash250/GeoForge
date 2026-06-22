import type { DemoDefinition } from '../../registry/types';
import StubDemoInspector from './StubDemoInspector.svelte';

type StubDemoInspectorProps = {
  title: string;
  description: string;
  code: string;
};

type StubDemoOptions = {
  id: string;
  title: string;
  description: string;
  docsPath: string;
};

export function createStubDemo({
  id,
  title,
  description,
  docsPath
}: StubDemoOptions): DemoDefinition<StubDemoInspectorProps> {
  return {
    id,
    title,
    description,
    docsPath,
    code: () => `// ${title}\n// This demo module is planned.`,
    inspector: StubDemoInspector,
    setup: ({ notify }) => {
      notify({
        title,
        body: 'This slot is registered in the Demo Studio shell; its interactive workflow lands in a later milestone.',
        tone: 'info'
      });

      return {
        teardown: () => {}
      };
    }
  };
}
