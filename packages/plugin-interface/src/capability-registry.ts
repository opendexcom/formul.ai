const capabilityRegistry = new Set<string>();

export function registerCapability(name: string): void {
  if (!name || typeof name !== 'string') {
    throw new Error('Capability name must be a non-empty string.');
  }
  capabilityRegistry.add(name);
}

export function getCapabilities(): string[] {
  return [...capabilityRegistry].sort();
}

export function hasCapability(name: string): boolean {
  return capabilityRegistry.has(name);
}

export function clearCapabilityRegistry(): void {
  capabilityRegistry.clear();
}
