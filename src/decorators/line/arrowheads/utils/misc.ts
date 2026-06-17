export function definedProps<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

export function modulus(index: number, length: number): number {
  return ((index % length) + length) % length;
}
