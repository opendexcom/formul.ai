import { init } from '@mlflow/core';
import { LangChainInstrumentation } from '@arizeai/openinference-instrumentation-langchain';
import * as CallbackManagerModule from '@langchain/core/callbacks/manager';

let tracingEnabled = false;

export function isMlflowTracingEnabled(): boolean {
  return tracingEnabled;
}

function tracingDisabledByEnv(): boolean {
  return process.env.MLFLOW_TRACING_ENABLED === 'false';
}

async function resolveExperimentId(trackingUri: string): Promise<string | undefined> {
  const configured = process.env.MLFLOW_EXPERIMENT_ID?.trim();
  if (configured) return configured;

  const name = process.env.MLFLOW_EXPERIMENT_NAME?.trim() || 'formulai';
  const base = trackingUri.replace(/\/$/, '');

  try {
    const getRes = await fetch(
      `${base}/api/2.0/mlflow/experiments/get-by-name?experiment_name=${encodeURIComponent(name)}`,
    );
    if (getRes.ok) {
      const data = (await getRes.json()) as {
        experiment?: { experiment_id?: string };
      };
      const id = data.experiment?.experiment_id;
      if (id) return String(id);
    }

    const createRes = await fetch(`${base}/api/2.0/mlflow/experiments/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (createRes.ok) {
      const data = (await createRes.json()) as { experiment_id?: string };
      if (data.experiment_id) return String(data.experiment_id);
    }
  } catch (error) {
    console.warn(
      `[MLflow tracing] Failed to resolve experiment "${name}":`,
      (error as Error).message,
    );
  }

  return undefined;
}

/**
 * Initializes MLflow tracing for LangChain.js via @mlflow/core + OpenInference.
 * Must run before the first LangChain model invocation (call from main/worker bootstrap).
 */
export async function initMlflowLangchainTracing(): Promise<void> {
  if (tracingDisabledByEnv()) {
    console.log('[MLflow tracing] Disabled (MLFLOW_TRACING_ENABLED=false)');
    return;
  }

  const trackingUri = process.env.MLFLOW_TRACKING_URI?.trim();
  if (!trackingUri) {
    console.log('[MLflow tracing] Skipped (MLFLOW_TRACKING_URI is not set)');
    return;
  }

  const experimentId = await resolveExperimentId(trackingUri);
  if (!experimentId) {
    console.warn(
      '[MLflow tracing] Skipped (could not resolve MLFLOW_EXPERIMENT_ID; set it explicitly or ensure MLflow is reachable)',
    );
    return;
  }

  init({
    trackingUri,
    experimentId,
  });

  const lcInstrumentation = new LangChainInstrumentation();
  lcInstrumentation.manuallyInstrument(CallbackManagerModule);

  tracingEnabled = true;
  console.log(
    `[MLflow tracing] LangChain instrumentation enabled → ${trackingUri} (experiment ${experimentId} / ${process.env.MLFLOW_EXPERIMENT_NAME || 'formulai'})`,
  );
  console.log(
    '[MLflow tracing] View traces at %s/#/experiments/%s/traces',
    trackingUri,
    experimentId,
  );
}

export async function flushMlflowTraces(): Promise<void> {
  if (!tracingEnabled) return;
  const { flushTraces } = await import('@mlflow/core');
  await flushTraces();
}
