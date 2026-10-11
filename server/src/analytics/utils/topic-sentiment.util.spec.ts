import { buildCanonicalTopicSentiments } from './topic-sentiment.util';

describe('topic-sentiment.util', () => {
  const mapping = {
    'team building': 'Team Collaboration',
    'employee recognition': 'Recognition',
  };

  it('uses per-topic sentiment from topicDetails', () => {
    const result = buildCanonicalTopicSentiments(
      [
        {
          topic: 'Team Building',
          sentiment: 'positive',
          score: 0.8,
        },
        {
          topic: 'Employee Recognition',
          sentiment: 'negative',
          score: -0.7,
        },
      ],
      ['Team Collaboration', 'Recognition'],
      mapping,
      { label: 'neutral', score: 0 },
    );

    expect(result).toEqual([
      { topic: 'Team Collaboration', label: 'positive', score: 0.8 },
      { topic: 'Recognition', label: 'negative', score: -0.7 },
    ]);
  });

  it('falls back to overall sentiment when topic detail missing', () => {
    const result = buildCanonicalTopicSentiments(
      [{ topic: 'Team Building', sentiment: 'positive', score: 0.5 }],
      ['Team Collaboration', 'Recognition'],
      mapping,
      { label: 'negative', score: -0.5 },
    );

    expect(result[0]).toEqual({
      topic: 'Team Collaboration',
      label: 'positive',
      score: 0.5,
    });
    expect(result[1]).toEqual({
      topic: 'Recognition',
      label: 'negative',
      score: -0.5,
    });
  });
});
