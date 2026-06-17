export function isInMeters(value: unknown): value is `${number}m` {
  if (typeof value !== 'string') {
    return false;
  }
  return value.trim().toLowerCase().endsWith('m');
}

export function isInPercent(value: unknown): value is `${number}%` {
  if (typeof value !== 'string') {
    return false;
  }
  return value.trim().endsWith('%');
}

export function isInPixels(value: unknown): value is `${number}px` {
  if (typeof value !== 'string') {
    return false;
  }
  return value.trim().toLowerCase().endsWith('px');
}

export function parseNumeric(value: string): number {
  return Number(value.replace(/[^0-9.+-]/g, ''));
}
