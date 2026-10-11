import { parseJsonCommand, parseTextCommand } from './command-parser.util';

describe('parseTextCommand', () => {
  it('parses help commands', () => {
    expect(parseTextCommand('help').type).toBe('help');
    expect(parseTextCommand('/formulai help').type).toBe('help');
    expect(parseTextCommand('/formulaihelp').type).toBe('help');
    expect(parseTextCommand('').type).toBe('help');
  });

  it('parses create study from slash command text', () => {
    const command = parseTextCommand('/formulai new-study "Employee Feedback"');
    expect(command.type).toBe('create_study');
    expect(command.args.name).toBe('Employee Feedback');
  });

  it('parses new-study with double-quoted name', () => {
    const command = parseTextCommand('new-study "Name"');
    expect(command.type).toBe('create_study');
    expect(command.args.name).toBe('Name');
  });

  it('parses /formulai create-study with single-quoted name', () => {
    const command = parseTextCommand("/formulai create-study 'Name'");
    expect(command.type).toBe('create_study');
    expect(command.args.name).toBe('Name');
  });

  it('parses create_study with an unquoted name that contains spaces', () => {
    const command = parseTextCommand('create_study Name with spaces');
    expect(command.type).toBe('create_study');
    expect(command.args.name).toBe('Name with spaces');
  });

  it('parses create-study and createstudy aliases', () => {
    expect(parseTextCommand('create-study "Alias"').args.name).toBe('Alias');
    expect(parseTextCommand('createstudy "Compact"').args.name).toBe('Compact');
  });

  it('parses a create command that follows leading text', () => {
    const command = parseTextCommand('please new-study "Follow-up"');
    expect(command.type).toBe('create_study');
    expect(command.args.name).toBe('Follow-up');
  });

  it('is case-insensitive for create commands', () => {
    const command = parseTextCommand('NEW-STUDY "Case"');
    expect(command.type).toBe('create_study');
    expect(command.args.name).toBe('Case');
  });

  it('returns unknown for unrecognized text', () => {
    expect(parseTextCommand('hello world').type).toBe('unknown');
    expect(parseTextCommand('new-study').type).toBe('unknown');
    expect(parseTextCommand('mynew-study "Hidden"').type).toBe('unknown');
  });

  it('parses adversarial repeated tokens within a tight time bound', () => {
    const input = ' new-study !'.repeat(25_000);
    const started = process.hrtime.bigint();
    const command = parseTextCommand(input);
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

    expect(command.type).toBe('create_study');
    expect(command.args.name?.startsWith('!')).toBe(true);
    expect(elapsedMs).toBeLessThan(100);
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
