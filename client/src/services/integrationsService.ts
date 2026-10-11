import { apiClient } from './apiClient';
import { getErrorMessage } from '../utils/errorHandling';

export type IntegrationProviderKey = 'slack' | 'teams' | 'discord' | 'genericWebhook';

export interface IntegrationProviderStatus {
  connected: boolean;
  available: boolean;
  hookUrl: string | null;
  lastUsedAt: string | null;
  hasDiscordPublicKey?: boolean;
}

export interface IntegrationsStatusResponse {
  slack: IntegrationProviderStatus;
  teams: IntegrationProviderStatus;
  discord: IntegrationProviderStatus;
  genericWebhook: IntegrationProviderStatus;
  analysisApi: IntegrationProviderStatus;
}

export interface SetupGuideStep {
  title: string;
  description: string;
}

export interface SetupGuide {
  title: string;
  steps: SetupGuideStep[];
  exampleCommand?: string;
}

export interface ConnectIntegrationResponse {
  provider: string;
  hookId: string;
  hookUrl: string;
  secret: string;
  connected: boolean;
  setupInstructions: SetupGuide;
}

const providerPathMap: Record<IntegrationProviderKey, string> = {
  slack: 'slack',
  teams: 'teams',
  discord: 'discord',
  genericWebhook: 'generic_webhook',
};

export async function getIntegrationsStatus(): Promise<IntegrationsStatusResponse> {
  try {
    const response = await apiClient.get<IntegrationsStatusResponse>('/integrations/status');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to load integration status'));
  }
}

export async function connectIntegration(
  provider: IntegrationProviderKey,
  options?: { discordPublicKey?: string },
): Promise<ConnectIntegrationResponse> {
  try {
    const response = await apiClient.post<ConnectIntegrationResponse>(
      `/integrations/${providerPathMap[provider]}/connect`,
      options ?? {},
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to connect integration'));
  }
}

export async function disconnectIntegration(
  provider: IntegrationProviderKey,
): Promise<{ success: boolean }> {
  try {
    const response = await apiClient.delete<{ success: boolean }>(
      `/integrations/${providerPathMap[provider]}`,
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to disconnect integration'));
  }
}
