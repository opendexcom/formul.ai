import React, { useCallback, useEffect, useState } from 'react';
import { MessageSquare, Webhook, Hash, Users, X, Copy, Check } from 'lucide-react';
import PluginSlot from '../plugins/PluginSlot';
import { shellCardClass, shellPageDescriptionClass, shellPageTitleClass } from '../components/shell/design-tokens';
import {
  connectIntegration,
  disconnectIntegration,
  getIntegrationsStatus,
  type ConnectIntegrationResponse,
  type IntegrationProviderKey,
  type IntegrationProviderStatus,
  type IntegrationsStatusResponse,
} from '../services/integrationsService';

type ProviderCardConfig = {
  key: IntegrationProviderKey;
  title: string;
  description: string;
  bullets: string[];
  icon: React.ReactNode;
  iconBg: string;
  supportsDiscordPublicKey?: boolean;
};

const PROVIDERS: ProviderCardConfig[] = [
  {
    key: 'slack',
    title: 'Slack',
    description: 'Start studies from slash commands or outgoing webhooks.',
    bullets: [
      'Connect your Slack workspace via a shared inbound hook URL',
      'Send `/formulai new-study "Name"` to create a study',
      'Response notifications via chat (coming soon)',
    ],
    icon: <MessageSquare className="h-6 w-6" />,
    iconBg: 'bg-purple-50 text-purple-700',
  },
  {
    key: 'discord',
    title: 'Discord',
    description: 'Use slash commands through the Discord Interactions endpoint.',
    bullets: [
      'Set your Interactions Endpoint URL to the FormulAI hook URL',
      'Verify requests with your Application Public Key',
      'Register `/formulai` with a `name` option',
    ],
    icon: <Hash className="h-6 w-6" />,
    iconBg: 'bg-indigo-50 text-indigo-700',
    supportsDiscordPublicKey: true,
  },
  {
    key: 'teams',
    title: 'Microsoft Teams',
    description: 'Trigger study creation from Teams connectors or Power Automate.',
    bullets: [
      'Point an outgoing webhook or flow to your FormulAI hook URL',
      'Send `new-study "Name"` in the message body',
      'Works with shared-secret authentication',
    ],
    icon: <Users className="h-6 w-6" />,
    iconBg: 'bg-blue-50 text-blue-700',
  },
  {
    key: 'genericWebhook',
    title: 'Generic webhook',
    description: 'Connect any system that can POST JSON to an HTTP endpoint.',
    bullets: [
      'Use Bearer token or X-FormulAI-Secret authentication',
      'Send JSON such as `{"command":"create_study","name":"..."}`',
      'Ideal for Zapier, custom bots, or internal tools',
    ],
    icon: <Webhook className="h-6 w-6" />,
    iconBg: 'bg-green-50 text-green-700',
  },
];

function getProviderStatus(
  status: IntegrationsStatusResponse | null,
  key: IntegrationProviderKey,
): IntegrationProviderStatus | null {
  if (!status) return null;
  return status[key];
}

function formatLastUsed(value: string | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toLocaleString();
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex gap-2">
        <input
          readOnly
          value={value}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800"
        />
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

interface ConnectWizardProps {
  provider: ProviderCardConfig;
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
}

const ConnectWizard: React.FC<ConnectWizardProps> = ({
  provider,
  open,
  onClose,
  onConnected,
}) => {
  const [discordPublicKey, setDiscordPublicKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [connection, setConnection] = useState<ConnectIntegrationResponse | null>(null);
  const [polling, setPolling] = useState(false);

  const loadConnection = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await connectIntegration(provider.key, {
        discordPublicKey: provider.supportsDiscordPublicKey
          ? discordPublicKey.trim() || undefined
          : undefined,
      });
      setConnection(result);
      setPolling(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setLoading(false);
    }
  }, [provider.key, provider.supportsDiscordPublicKey, discordPublicKey]);

  useEffect(() => {
    if (!open) {
      setConnection(null);
      setPolling(false);
      setError('');
      setDiscordPublicKey('');
    }
  }, [open]);

  useEffect(() => {
    if (!polling || !open) return undefined;

    const interval = window.setInterval(async () => {
      try {
        const status = await getIntegrationsStatus();
        const providerStatus = getProviderStatus(status, provider.key);
        if (providerStatus?.connected) {
          setPolling(false);
          onConnected();
        }
      } catch {
        // Keep polling quietly until user closes modal
      }
    }, 3000);

    return () => window.clearInterval(interval);
  }, [polling, open, provider.key, onConnected]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Connect {provider.title}</h2>
            <p className="mt-1 text-sm text-gray-500">{provider.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!connection ? (
          <div className="space-y-4">
            {provider.supportsDiscordPublicKey ? (
              <div>
                <label
                  htmlFor="discord-public-key"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Discord Application Public Key
                </label>
                <input
                  id="discord-public-key"
                  value={discordPublicKey}
                  onChange={(event) => setDiscordPublicKey(event.target.value)}
                  placeholder="Paste your Discord app public key"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            ) : null}

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <button
              type="button"
              onClick={loadConnection}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Generating hook…' : 'Generate hook URL'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <CopyField label="Hook URL" value={connection.hookUrl} />
            <CopyField label="Secret" value={connection.secret} />

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-900">
                {connection.setupInstructions.title}
              </h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-600">
                {connection.setupInstructions.steps.map((step) => (
                  <li key={step.title}>
                    <span className="font-medium text-gray-800">{step.title}. </span>
                    {step.description}
                  </li>
                ))}
              </ol>
              {connection.setupInstructions.exampleCommand ? (
                <pre className="mt-3 overflow-x-auto rounded bg-white p-3 text-xs text-gray-700">
                  {connection.setupInstructions.exampleCommand}
                </pre>
              ) : null}
            </div>

            <p className="text-sm text-gray-600">
              {polling
                ? 'Waiting for your first successful command…'
                : 'Send a test command from your platform to finish setup.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const IntegrationsPage: React.FC = () => {
  const [status, setStatus] = useState<IntegrationsStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeProvider, setActiveProvider] = useState<ProviderCardConfig | null>(null);
  const [actionLoading, setActionLoading] = useState<IntegrationProviderKey | null>(null);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const nextStatus = await getIntegrationsStatus();
      setStatus(nextStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const handleDisconnect = async (provider: IntegrationProviderKey) => {
    setActionLoading(provider);
    try {
      await disconnectIntegration(provider);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className={shellPageTitleClass}>Integrations</h1>
        <p className={shellPageDescriptionClass}>
          Connect FormulAI with chat tools and external workflows.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading && !status ? <p className="text-sm text-gray-500">Loading integrations…</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {PROVIDERS.map((provider) => {
          const providerStatus = getProviderStatus(status, provider.key);
          const connected = providerStatus?.connected === true;
          const lastUsed = formatLastUsed(providerStatus?.lastUsedAt);

          return (
            <div key={provider.key} className={shellCardClass}>
              <div className="flex items-start gap-4">
                <span className={`rounded-lg p-3 ${provider.iconBg}`}>{provider.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-gray-900">{provider.title}</h2>
                    {connected ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Connected
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{provider.description}</p>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-600">
                    {provider.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                  {providerStatus?.hookUrl ? (
                    <p className="mt-3 break-all text-xs text-gray-500">
                      Hook URL: {providerStatus.hookUrl}
                    </p>
                  ) : null}
                  {lastUsed ? (
                    <p className="mt-1 text-xs text-gray-500">Last used: {lastUsed}</p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveProvider(provider)}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      {connected ? 'Reconnect' : 'Connect'}
                    </button>
                    {connected || providerStatus?.hookUrl ? (
                      <button
                        type="button"
                        onClick={() => void handleDisconnect(provider.key)}
                        disabled={actionLoading === provider.key}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                      >
                        Disconnect
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={shellCardClass}>
        <div className="flex items-start gap-4">
          <span className="rounded-lg bg-blue-50 p-3 text-blue-700">
            <Webhook className="h-6 w-6" />
          </span>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-900">Create study via integration</h2>
            <p className="mt-1 text-sm text-gray-600">
              Start a new study from chat commands or incoming webhooks without opening the
              dashboard.
            </p>
            <p className="mt-3 text-sm text-gray-500">
              Example flow: `/formulai new-study "Employee Feedback"` → project created → redirect
              to variant setup.
            </p>
          </div>
        </div>
      </div>

      <PluginSlot name="integrations.eePanel" />

      {activeProvider ? (
        <ConnectWizard
          provider={activeProvider}
          open={Boolean(activeProvider)}
          onClose={() => setActiveProvider(null)}
          onConnected={() => {
            void refreshStatus();
            setActiveProvider(null);
          }}
        />
      ) : null}
    </div>
  );
};

export default IntegrationsPage;
