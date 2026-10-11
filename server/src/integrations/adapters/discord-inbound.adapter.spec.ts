import type { Request } from 'express';
import { DiscordInboundAdapter } from './discord-inbound.adapter';

describe('DiscordInboundAdapter', () => {
  const adapter = new DiscordInboundAdapter();

  it('returns PING response for interaction type 1', () => {
    const body = Buffer.from(JSON.stringify({ type: 1 }));
    const req = { body: JSON.parse(body.toString()) } as unknown as Request;
    expect(adapter.tryEarlyResponse?.(req, body)).toEqual({ type: 1 });
  });

  it('parses slash command interaction with name option', () => {
    const payload = {
      type: 2,
      data: {
        name: 'formulai',
        options: [{ name: 'name', value: 'Employee Feedback' }],
      },
      member: { user: { id: '123' } },
      channel_id: '456',
    };
    const body = Buffer.from(JSON.stringify(payload));
    const req = { body: payload } as unknown as Request;

    const command = adapter.parse(req, body);
    expect(command?.type).toBe('create_study');
    expect(command?.args.name).toBe('Employee Feedback');
    expect(command?.externalUserId).toBe('123');
  });

  it('formats interaction response', () => {
    const response = adapter.formatResponse({
      success: true,
      message: 'Created study',
    });
    expect(response).toEqual({
      type: 4,
      data: { content: 'Created study' },
    });
  });
});
