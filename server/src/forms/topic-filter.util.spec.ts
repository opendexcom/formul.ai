import { buildTopicFilterQuery } from './topic-filter.util';

describe('buildTopicFilterQuery', () => {
  it('returns null for empty topics', () => {
    expect(buildTopicFilterQuery([])).toBeNull();
    expect(buildTopicFilterQuery(['', '  '])).toBeNull();
  });

  it('builds case-insensitive OR across topic metadata fields', () => {
    const query = buildTopicFilterQuery(['Team Collaboration']);
    expect(query).toEqual({
      $or: [
        { 'metadata.canonicalTopics': /^Team Collaboration$/i },
        { 'metadata.discoveredTopics': /^Team Collaboration$/i },
        { 'metadata.allTopics': /^Team Collaboration$/i },
        { 'metadata.primaryTopics': /^Team Collaboration$/i },
      ],
    });
  });

  it('escapes regex special characters in topic names', () => {
    const query = buildTopicFilterQuery(['C++ (legacy)']);
    const orClause = query!.$or as Array<Record<string, RegExp>>;
    const regex = orClause[2]['metadata.allTopics'];
    expect(regex.source).toBe('^C\\+\\+ \\(legacy\\)$');
    expect(regex.flags).toBe('i');
  });

  it('matches any selected topic (OR across topics)', () => {
    const query = buildTopicFilterQuery(['communication', 'motivation']);
    expect(query!.$or).toHaveLength(8);
  });
});
