import { describe, expect, it, vi } from 'vitest';
import type { StyleImageInterface } from 'maplibre-gl';
import { ensureSymbolImage } from '../../../../src/decorators/line/symbols/index.ts';

function createMapStub(existingImages: string[] = []) {
  const images = new Set(existingImages);

  return {
    hasImage: vi.fn((id: string) => images.has(id)),
    addImage: vi.fn((id: string) => {
      images.add(id);
    }),
  };
}

describe('ensureSymbolImage', () => {
  it('does not add an image that is already registered', () => {
    const map = createMapStub(['line-arrow']);
    const image = { width: 16, height: 16, data: new Uint8Array(16 * 16 * 4) };

    ensureSymbolImage(map, { id: 'line-arrow', image });

    expect(map.hasImage).toHaveBeenCalledWith('line-arrow');
    expect(map.addImage).not.toHaveBeenCalled();
  });

  it('adds a missing image with MapLibre image options', () => {
    const map = createMapStub();
    const image: StyleImageInterface = {
      width: 16,
      height: 16,
      data: new Uint8Array(16 * 16 * 4),
    };

    ensureSymbolImage(map, {
      id: 'line-arrow',
      image,
      options: { pixelRatio: 2, sdf: true },
    });

    expect(map.hasImage).toHaveBeenCalledWith('line-arrow');
    expect(map.addImage).toHaveBeenCalledWith('line-arrow', image, { pixelRatio: 2, sdf: true });
  });

  it('accepts MapLibre addImage image input types', () => {
    const map = createMapStub();
    const styleImage: StyleImageInterface = {
      width: 16,
      height: 16,
      data: new Uint8Array(16 * 16 * 4),
    };

    ensureSymbolImage(map, { id: 'image-bitmap', image: styleImage as unknown as ImageBitmap });
    ensureSymbolImage(map, { id: 'image-data', image: styleImage as unknown as ImageData });
    ensureSymbolImage(map, { id: 'html-image', image: styleImage as unknown as HTMLImageElement });
    ensureSymbolImage(map, { id: 'style-image', image: styleImage });

    expect(map.addImage).toHaveBeenCalledTimes(4);
  });
});
