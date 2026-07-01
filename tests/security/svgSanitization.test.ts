// @vitest-environment jsdom
import { TextEncoder } from 'node:util';
import { describe, expect, test } from 'vitest';

describe('SVG sanitization', () => {
  test('sanitizes configured marker SVG before inserting marker markup', async () => {
    const textEncoderDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'TextEncoder');
    const uint8ArrayDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Uint8Array');
    const createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    const originalGeomanVersion = process.env.VITE_GEOFORGE_VERSION;

    Object.defineProperty(globalThis, 'TextEncoder', {
      configurable: true,
      value: TextEncoder,
    });
    Object.defineProperty(globalThis, 'Uint8Array', {
      configurable: true,
      value: new TextEncoder().encode('').constructor,
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: () => 'blob:svg-sanitization-test',
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: () => {},
    });
    process.env.VITE_GEOFORGE_VERSION = 'free';

    const { createGeoForgeSsrServer } = await import('../utils/viteSsrServer.ts');
    const server = await createGeoForgeSsrServer({
      layerStyleStubId: '\0svg-sanitization-layer-style-stub',
      layerStyleStubModule: 'export default {};',
    });

    try {
      const { Geoman } = await server.ssrLoadModule('/src/index.ts');
      const geoman = Object.assign(Object.create(Geoman.prototype), {
        options: {
          settings: {
            markerIcons: {
              marker:
                '<svg xmlns="http://www.w3.org/2000/svg" onload="window.pwned=true"><script>alert(1)</script><foreignObject><p onclick="alert(2)">x</p></foreignObject><a href="javascript:alert(3)"><path d="M0 0h1v1z"/></a></svg>',
            },
          },
        },
      });

      const element = geoman.createSvgMarkerElement('marker');

      expect(element.innerHTML).toContain('<svg');
      expect(element.innerHTML).not.toContain('onload');
      expect(element.innerHTML).not.toContain('onclick');
      expect(element.innerHTML).not.toContain('<script');
      expect(element.innerHTML).not.toContain('foreignObject');
      expect(element.innerHTML).not.toContain('javascript:');
    } finally {
      await server.close();

      if (textEncoderDescriptor) {
        Object.defineProperty(globalThis, 'TextEncoder', textEncoderDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, 'TextEncoder');
      }

      if (uint8ArrayDescriptor) {
        Object.defineProperty(globalThis, 'Uint8Array', uint8ArrayDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, 'Uint8Array');
      }

      if (createObjectUrlDescriptor) {
        Object.defineProperty(URL, 'createObjectURL', createObjectUrlDescriptor);
      } else {
        Reflect.deleteProperty(URL, 'createObjectURL');
      }

      if (revokeObjectUrlDescriptor) {
        Object.defineProperty(URL, 'revokeObjectURL', revokeObjectUrlDescriptor);
      } else {
        Reflect.deleteProperty(URL, 'revokeObjectURL');
      }

      if (originalGeomanVersion === undefined) {
        delete process.env.VITE_GEOFORGE_VERSION;
      } else {
        process.env.VITE_GEOFORGE_VERSION = originalGeomanVersion;
      }
    }
  });
});
