import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { FlowKey, LoadedPrompt } from './mlflow.types';
import { FlowsConfigService } from './flows.config';
import { PromptSandboxService } from './prompt-sandbox.service';
import {
  FlowNotRegisteredException,
  PromptRegistryUnavailableException,
} from './mlflow.exceptions';

interface PromptCacheEntry {
  prompt: LoadedPrompt;
  expiresAt: number;
}

@Injectable()
export class MlflowPromptService implements OnModuleInit {
  private readonly logger = new Logger(MlflowPromptService.name);
  private readonly cache = new Map<string, PromptCacheEntry>();

  constructor(
    private readonly flowsConfig: FlowsConfigService,
    private readonly sandbox: PromptSandboxService,
  ) {}

  onModuleInit(): void {
    this.validateTrackingUri();
  }

  private validateTrackingUri(): void {
    const uri = process.env.MLFLOW_TRACKING_URI;
    if (!uri) {
      this.logger.warn('MLFLOW_TRACKING_URI is not set');
      return;
    }
    const allowed = process.env.MLFLOW_TRACKING_URI_ALLOWED_HOSTS;
    if (!allowed) return;
    try {
      const hostname = new URL(uri).hostname;
      const allowedHosts = allowed.split(',').map((h) => h.trim());
      if (!allowedHosts.includes(hostname)) {
        throw new Error(
          `MLFLOW_TRACKING_URI host "${hostname}" not in MLFLOW_TRACKING_URI_ALLOWED_HOSTS`,
        );
      }
    } catch (e) {
      throw new Error(`Invalid MLFLOW_TRACKING_URI: ${(e as Error).message}`);
    }
  }

  private getTrackingUri(): string {
    const uri = process.env.MLFLOW_TRACKING_URI;
    if (!uri) {
      throw new PromptRegistryUnavailableException(
        'MLFLOW_TRACKING_URI is not configured',
      );
    }
    return uri.replace(/\/$/, '');
  }

  private cacheTtlMs(): number {
    const seconds = parseInt(
      process.env.MLFLOW_PROMPT_CACHE_TTL_SECONDS || '60',
      10,
    );
    return seconds * 1000;
  }

  async loadPrompt(name: string, alias?: string): Promise<LoadedPrompt> {
    const resolvedAlias = alias ?? this.flowsConfig.getPromptAlias();
    const cacheKey = `${name}@${resolvedAlias}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.prompt;
    }

    const trackingUri = this.getTrackingUri();
    const url = `${trackingUri}/api/2.0/mlflow/registered-models/alias?name=${encodeURIComponent(name)}&alias=${encodeURIComponent(resolvedAlias)}`;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: this.buildAuthHeaders(),
      });
    } catch (err) {
      throw new PromptRegistryUnavailableException(
        `Failed to reach MLflow: ${(err as Error).message}`,
      );
    }

    if (response.status === 404) {
      throw new PromptRegistryUnavailableException(
        `Prompt "${name}" with alias "${resolvedAlias}" not found in registry`,
      );
    }
    if (!response.ok) {
      throw new PromptRegistryUnavailableException(
        `MLflow returned ${response.status} for prompt ${name}`,
      );
    }

    const body = (await response.json()) as {
      model_version?: {
        version?: string;
        tags?: Array<{ key: string; value: string }>;
      };
    };
    const version = body.model_version?.version ?? 'unknown';
    const tags = body.model_version?.tags ?? [];
    const template =
      tags.find((t) => t.key === 'mlflow.prompt.text')?.value ??
      tags.find((t) => t.key === 'mlflow.prompt.template')?.value;

    if (!template) {
      throw new PromptRegistryUnavailableException(
        `Prompt "${name}" has no template text in registry tags`,
      );
    }

    const loaded: LoadedPrompt = {
      name,
      version,
      template,
      alias: resolvedAlias,
    };
    this.cache.set(cacheKey, {
      prompt: loaded,
      expiresAt: Date.now() + this.cacheTtlMs(),
    });
    return loaded;
  }

  private buildAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    const token = process.env.DATABRICKS_TOKEN;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  async formatFlow(
    flowKey: FlowKey,
    variables: Record<string, unknown>,
  ): Promise<{ prompt: string; loaded: LoadedPrompt }> {
    if (!this.flowsConfig.hasFlow(flowKey)) {
      throw new FlowNotRegisteredException(flowKey);
    }
    const flow = this.flowsConfig.getFlow(flowKey);
    const loaded = await this.loadPrompt(flow.prompt);
    const allowed = this.flowsConfig.getAllowedVariables(flowKey);
    const prompt = this.sandbox.formatTemplate(
      loaded.template,
      variables,
      allowed,
    );
    return { prompt, loaded };
  }

  async getRawTemplate(flowKey: FlowKey): Promise<LoadedPrompt> {
    if (!this.flowsConfig.hasFlow(flowKey)) {
      throw new FlowNotRegisteredException(flowKey);
    }
    const flow = this.flowsConfig.getFlow(flowKey);
    return this.loadPrompt(flow.prompt);
  }

  getPromptVersionsForFlows(flowKeys: FlowKey[]): Promise<Record<string, string>> {
    return flowKeys.reduce(
      async (accPromise, key) => {
        const acc = await accPromise;
        if (!this.flowsConfig.hasFlow(key)) return acc;
        const flow = this.flowsConfig.getFlow(key);
        const loaded = await this.loadPrompt(flow.prompt);
        acc[flow.prompt] = loaded.version;
        return acc;
      },
      Promise.resolve({} as Record<string, string>),
    );
  }
}
