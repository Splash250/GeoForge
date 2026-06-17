import type { StyleImageInterface, StyleImageMetadata } from 'maplibre-gl';

export type SymbolImageInput = ImageBitmap | ImageData | HTMLImageElement | StyleImageInterface;

export type SymbolImageRegistration = {
  id: string;
  image: SymbolImageInput;
  options?: Partial<StyleImageMetadata>;
};

export type SymbolImageMap = {
  hasImage: (id: string) => boolean;
  addImage: (id: string, image: SymbolImageInput, options?: Partial<StyleImageMetadata>) => unknown;
};

export function ensureSymbolImage(map: SymbolImageMap, registration: SymbolImageRegistration) {
  if (map.hasImage(registration.id)) {
    return;
  }

  map.addImage(registration.id, registration.image, registration.options);
}
