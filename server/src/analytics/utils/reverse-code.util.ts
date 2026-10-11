export function reverseCodeValue(value: number, min: number, max: number): number {
  return min + max - value;
}

export function getRatingBounds(validation?: Record<string, { value?: string | number }>): {
  min: number;
  max: number;
} {
  const minRaw = validation?.min?.value;
  const maxRaw = validation?.max?.value;
  const min =
    minRaw !== undefined && minRaw !== null && minRaw !== '' ? Number(minRaw) : 1;
  const max =
    maxRaw !== undefined && maxRaw !== null && maxRaw !== '' ? Number(maxRaw) : 5;
  return { min: Number.isNaN(min) ? 1 : min, max: Number.isNaN(max) ? 5 : max };
}

export function reverseCodeDistribution(
  distribution: Record<string, number>,
  min: number,
  max: number,
): Record<string, number> {
  const reversed: Record<string, number> = {};
  for (const [key, count] of Object.entries(distribution)) {
    const numeric = Number(key);
    if (Number.isNaN(numeric)) {
      reversed[key] = count;
      continue;
    }
    const flipped = reverseCodeValue(numeric, min, max);
    const flippedKey = String(flipped);
    reversed[flippedKey] = (reversed[flippedKey] ?? 0) + count;
  }
  return reversed;
}
