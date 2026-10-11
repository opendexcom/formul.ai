import {
  expandSelectedTopics,
  normalizeTopicLabel,
  topicMatchesFilter,
  normalizeThemes,
  canonicalizeTopicLabel,
} from './topic-filter.util';

describe('topic-filter.util', () => {
  const mapping = {
    'team-building activities': 'Team Collaboration',
    communication: 'Communication',
    'team collaboration': 'Team Collaboration',
  };

  it('expands raw selected topic to canonical label', () => {
    const expanded = expandSelectedTopics(
      ['team-building activities'],
      mapping,
    );
    expect(expanded).toEqual(
      expect.arrayContaining([
        'team-building activities',
        'Team Collaboration',
      ]),
    );
  });

  it('matches canonical card labels when raw topic is selected', () => {
    const expanded = expandSelectedTopics(
      ['team-building activities'],
      mapping,
    );
    expect(topicMatchesFilter('Team Collaboration', expanded)).toBe(true);
    expect(topicMatchesFilter('Communication', expanded)).toBe(false);
  });

  it('matches case-insensitively', () => {
    const expanded = expandSelectedTopics(['Communication'], mapping);
    expect(topicMatchesFilter('communication', expanded)).toBe(true);
    expect(normalizeTopicLabel(' Communication ')).toBe('communication');
  });

  it('normalizes and merges themes to canonical labels', () => {
    const normalized = normalizeThemes(
      [
        { theme: 'team-building activities', frequency: 4 },
        { theme: 'team collaboration', frequency: 2 },
        { theme: 'communication', frequency: 3 },
      ],
      mapping,
    );
    expect(normalized.map((t) => ({ theme: t.theme, frequency: t.frequency }))).toEqual([
      { theme: 'Team Collaboration', frequency: 6 },
      { theme: 'Communication', frequency: 3 },
    ]);
  });

  it('canonicalizeTopicLabel returns input when unmapped', () => {
    expect(canonicalizeTopicLabel('Pay', {})).toBe('Pay');
  });
});
