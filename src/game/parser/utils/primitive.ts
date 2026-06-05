export function parseLoosePrimitive(value: string): string | number | boolean {
  const normalized = value.trim();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(normalized)) {
    return parseFloat(normalized);
  }
  return value;
}
