export function getNextVariantKey(
  variants: Array<{ key: 'main' | 'A' | 'B' }>,
): 'A' | 'B' | null {
  const keys = new Set(variants.map((variant) => variant.key));
  if (!keys.has('A')) return 'A';
  if (!keys.has('B')) return 'B';
  return null;
}
