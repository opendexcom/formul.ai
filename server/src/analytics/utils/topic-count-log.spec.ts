import { logResponseTopicCount } from './topic-count-log';
import { StatisticsCalculator } from '../calculators/statistics.calculator';

function flattenLogs(calls: unknown[][]): string {
  return calls
    .map((args) => args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '))
    .join('\n');
}

describe('logResponseTopicCount', () => {
  it('logs only response id and topic count', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      logResponseTopicCount('[saveChunkResults] extracted topics', {
        responseId: 'resp-1',
        topicCount: 3,
      });

      const logs = flattenLogs(logSpy.mock.calls);
      expect(logs).toContain('[saveChunkResults] extracted topics');
      expect(logs).toContain('resp-1');
      expect(logs).toContain('"topicCount":3');
      expect(logs).not.toContain('Workload');
    } finally {
      logSpy.mockRestore();
    }
  });
});

describe('StatisticsCalculator topic logs', () => {
  it('does not log extracted topic text from responses', () => {
    const calculator = new StatisticsCalculator();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      calculator.calculateTopicFrequencies([
        {
          _id: 'resp-sensitive',
          answers: [],
          metadata: {
            canonicalTopics: ['Salary complaint about Alice', 'Workload'],
            overallSentiment: { label: 'negative' },
          },
        },
      ] as any);

      const logs = flattenLogs(logSpy.mock.calls);
      expect(logs).toContain('resp-sensitive');
      expect(logs).toContain('"topicCount":2');
      expect(logs).not.toContain('Salary complaint about Alice');
      expect(logs).not.toContain('Workload');
    } finally {
      logSpy.mockRestore();
    }
  });
});
