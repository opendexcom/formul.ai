import {
  buildDeterministicTopicMapping,
  normalizeCanonicalTopicLabel,
} from './normalize-canonical-topic.util';

describe('normalize-canonical-topic.util', () => {
  it('title-cases and collapses whitespace', () => {
    expect(normalizeCanonicalTopicLabel('  team   collaboration ')).toBe(
      'Team Collaboration',
    );
  });

  it('merges case variants in deterministic mapping', () => {
    const mapping = buildDeterministicTopicMapping([
      'Team Collaboration',
      'team collaboration',
      'Remote Work',
    ]);

    expect(mapping['team collaboration']).toBe('Team Collaboration');
    expect(mapping['remote work']).toBe('Remote Work');
    expect(new Set(Object.values(mapping)).size).toBe(2);
  });
});
