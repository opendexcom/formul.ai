import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  IntegrationInboundAdapter,
  IntegrationProviderId,
} from './integration-adapter.interface';

@Injectable()
export class AdapterRegistryService {
  private readonly adapters = new Map<IntegrationProviderId, IntegrationInboundAdapter>();

  register(adapter: IntegrationInboundAdapter): void {
    this.adapters.set(adapter.providerId, adapter);
  }

  get(providerId: IntegrationProviderId): IntegrationInboundAdapter {
    const adapter = this.adapters.get(providerId);
    if (!adapter) {
      throw new NotFoundException(`No integration adapter registered for provider: ${providerId}`);
    }
    return adapter;
  }

  list(): IntegrationInboundAdapter[] {
    return Array.from(this.adapters.values());
  }
}
