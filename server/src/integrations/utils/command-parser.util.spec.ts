import { parseJsonCommand, parseTextCommand } from './command-parser.util';

describe('parseTextCommand', () => {
  it('parses help commands', () => {
    expect(parseTextCommand('help').type).toBe('help');
    expect(parseTextCommand('/formulai help').type).toBe('help');
  });

  it('parses create study from slash command text', () => {
    const command = parseTextCommand('/formulai new-study "Employee Feedback"');
    expect(command.type).toBe('create_study');
    expect(command.args.name).toBe('Employee Feedback');
  });

  it('returns unknown for unrecognized text', () => {
    expect(parseTextCommand('hello world').type).toBe('unknown');
  });
});

describe('parseJsonCommand', () => {
  it('parses create_study JSON command', () => {
    const command = parseJsonCommand({
      command: 'create_study',
      name: 'Employee Feedback',
    });
    expect(command.type).toBe('create_study');
    expect(command.args.name).toBe('Employee Feedback');
  });

  it('parses help JSON command', () => {
    expect(parseJsonCommand({ command: 'help' }).type).toBe('help');
  });
});
