import {
  UnionFind,
  buildClustersFromGroups,
  pickCanonicalLabelFromCluster,
  normalizeTopicKey,
  TopicClusterMember,
} from './topic-vector-cluster.util';

describe('topic-vector-cluster.util', () => {
  describe('UnionFind', () => {
    it('merges connected keys into one group', () => {
      const uf = new UnionFind();
      uf.union('a', 'b');
      uf.union('b', 'c');
      expect(uf.find('a')).toBe(uf.find('c'));

      const groups = uf.groups();
      expect(groups.size).toBe(1);
      expect(Array.from(groups.values())[0].sort()).toEqual(['a', 'b', 'c']);
    });

    it('keeps dissimilar keys in separate groups', () => {
      const uf = new UnionFind();
      uf.add('pay');
      uf.add('culture');
      const groups = uf.groups();
      expect(groups.size).toBe(2);
    });
  });

  describe('pickCanonicalLabelFromCluster', () => {
    it('prefers highest response_count then shortest label', () => {
      const members: TopicClusterMember[] = [
        { topicKey: '1', topicText: 'Work Life Balance', responseCount: 2 },
        { topicKey: '2', topicText: 'WLB', responseCount: 5 },
        { topicKey: '3', topicText: 'work-life balance', responseCount: 5 },
      ];
      expect(pickCanonicalLabelFromCluster(members)).toBe('WLB');
    });
  });

  describe('buildClustersFromGroups', () => {
    it('maps group keys to cluster members', () => {
      const memberByKey = new Map<string, TopicClusterMember>([
        ['k1', { topicKey: 'k1', topicText: 'A', responseCount: 1 }],
        ['k2', { topicKey: 'k2', topicText: 'B', responseCount: 2 }],
      ]);
      const groups = new Map([['root', ['k1', 'k2']]]);
      const clusters = buildClustersFromGroups(groups, memberByKey);
      expect(clusters).toHaveLength(1);
      expect(clusters[0].members).toHaveLength(2);
    });
  });

  describe('normalizeTopicKey', () => {
    it('lowercases and trims topic text', () => {
      expect(normalizeTopicKey('  Company Culture ')).toBe('company culture');
    });
  });
});
