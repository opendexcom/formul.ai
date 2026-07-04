import type { Request } from 'express';
import { GenericWebhookAdapter } from './generic-webhook.adapter';
import {
  generateInboundSecret,
  hashInboundSecret,
} from '../utils/integration-secret.util';
import type { IntegrationConnectionDocument } from '../../schemas/integration-connection.schema';

describe('GenericWebhookAdapter', () => {
  const adapter = new GenericWebhookAdapter();
  const secret = generateInboundSecret();

  const connection = {
    config: { secretHash: hashInboundSecret(secret) },
  } as IntegrationConnectionDocument;

  it('verifies bearer secret', () => {
    const req = {
      headers: { authorization: `Bearer ${secret}` },
      query: {},
      body: { command: 'help' },
    } as unknown as Request;

    expect(adapter.verify(req, connection)).toBe(true);
  });

  it('parses create_study JSON payload', () => {
    const req = {
      body: { command: 'create_study', name: 'Team Survey' },
    } as unknown as Request;

    const command = adapter.parse(req);
    expect(command?.type).toBe('create_study');
    expect(command?.args.name).toBe('Team Survey');
  });
});
