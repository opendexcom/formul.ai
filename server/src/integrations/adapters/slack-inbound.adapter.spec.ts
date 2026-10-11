import type { Request } from 'express';
import { SlackInboundAdapter } from './slack-inbound.adapter';
import {
  generateInboundSecret,
  hashInboundSecret,
} from '../utils/integration-secret.util';
import type { IntegrationConnectionDocument } from '../../schemas/integration-connection.schema';

describe('SlackInboundAdapter', () => {
  const adapter = new SlackInboundAdapter();
  const secret = generateInboundSecret();

  const connection = {
    config: { secretHash: hashInboundSecret(secret) },
  } as IntegrationConnectionDocument;

  it('parses slash command payload', () => {
    const req = {
      body: {
        command: '/formulai',
        text: 'new-study "Employee Feedback"',
        user_id: 'U123',
        channel_id: 'C123',
      },
    } as unknown as Request;

    const command = adapter.parse(req);
    expect(command?.type).toBe('create_study');
    expect(command?.args.name).toBe('Employee Feedback');
    expect(command?.externalUserId).toBe('U123');
  });

  it('parses outgoing webhook text payload', () => {
    const req = {
      body: { text: '/formulai new-study "Team Survey"' },
    } as unknown as Request;

    const command = adapter.parse(req);
    expect(command?.type).toBe('create_study');
    expect(command?.args.name).toBe('Team Survey');
  });

  it('verifies shared secret header', () => {
    const req = {
      headers: { 'x-formulai-secret': secret },
      query: {},
      body: {},
    } as unknown as Request;

    expect(adapter.verify(req, connection)).toBe(true);
  });
});
