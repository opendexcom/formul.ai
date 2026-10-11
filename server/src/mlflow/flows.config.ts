import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  CachePolicy,
  FlowDefinition,
  FlowKey,
  FlowsConfig,
} from './mlflow.types';

@Injectable()
export class FlowsConfigService implements OnModuleInit {
  private readonly logger = new Logger(FlowsConfigService.name);
  private config!: FlowsConfig;
  private flowIndex = new Map<FlowKey, FlowDefinition>();

  onModuleInit(): void {
    this.loadConfig();
  }

  private resolveFlowsPath(): string {
    const envPath = process.env.MLFLOW_FLOWS_PATH;
    if (envPath && fs.existsSync(envPath)) {
      return envPath;
    }
    const candidates = [
      path.join(process.cwd(), 'oss-core/mlflow/flows.yml'),
      path.join(process.cwd(), '../mlflow/flows.yml'),
      path.join(__dirname, '../../../mlflow/flows.yml'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    throw new Error('MLflow flows.yml not found');
  }

  private loadConfig(): void {
    const flowsPath = this.resolveFlowsPath();
    const raw = yaml.load(fs.readFileSync(flowsPath, 'utf-8')) as FlowsConfig;
    this.config = raw;

    const pluginDir = process.env.PLUGIN_DIR;
    const eeFlowsPath = pluginDir
      ? path.join(pluginDir, 'ee-backend/mlflow/flows.document-form.yml')
      : path.join(process.cwd(), 'ee-backend/mlflow/flows.document-form.yml');

    if (fs.existsSync(eeFlowsPath)) {
      const eeRaw = yaml.load(
        fs.readFileSync(eeFlowsPath, 'utf-8'),
      ) as FlowsConfig;
      for (const [group, entries] of Object.entries(eeRaw.flows ?? {})) {
        this.config.flows[group] = {
          ...(this.config.flows[group] ?? {}),
          ...entries,
        };
      }
    }

    this.flowIndex.clear();
    for (const [group, entries] of Object.entries(this.config.flows ?? {})) {
      for (const [step, def] of Object.entries(entries)) {
        this.flowIndex.set(`${group}.${step}`, def);
      }
    }
    this.logger.log(
      `Loaded ${this.flowIndex.size} MLflow flows from ${flowsPath}`,
    );
  }

  getFlow(flowKey: FlowKey): FlowDefinition {
    const flow = this.flowIndex.get(flowKey);
    if (!flow) {
      throw new Error(`Flow not registered: ${flowKey}`);
    }
    return flow;
  }

  hasFlow(flowKey: FlowKey): boolean {
    return this.flowIndex.has(flowKey);
  }

  getPromptAlias(): string {
    return process.env.MLFLOW_PROMPT_ALIAS || this.config.defaults?.prompt_alias || 'production';
  }

  getCachePolicy(flowKey: FlowKey): CachePolicy {
    const flow = this.getFlow(flowKey);
    const cache = flow.cache ?? {};
    return {
      enabled: cache.enabled ?? false,
      mode: cache.mode ?? 'exact',
      scope: cache.scope ?? 'none',
      ttl_seconds: cache.ttl_seconds ?? 86400,
      similarity: cache.similarity ?? parseFloat(
        process.env.LLM_SEMANTIC_CACHE_SIMILARITY || '0.95',
      ),
    };
  }

  getAllowedVariables(flowKey: FlowKey): string[] {
    return this.getFlow(flowKey).allowed_variables ?? [];
  }
}
