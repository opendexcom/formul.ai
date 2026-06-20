export interface TopicClusterMember {
  topicKey: string;
  topicText: string;
  responseCount: number;
}

export interface TopicCluster {
  id: string;
  members: TopicClusterMember[];
}

/** Union-find for merging topics connected by embedding similarity. */
export class UnionFind {
  private parent = new Map<string, string>();

  add(key: string): void {
    if (!this.parent.has(key)) {
      this.parent.set(key, key);
    }
  }

  find(key: string): string {
    this.add(key);
    let root = key;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    let current = key;
    while (current !== root) {
      const next = this.parent.get(current)!;
      this.parent.set(current, root);
      current = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) {
      this.parent.set(rootB, rootA);
    }
  }

  groups(): Map<string, string[]> {
    const result = new Map<string, string[]>();
    for (const key of this.parent.keys()) {
      const root = this.find(key);
      if (!result.has(root)) {
        result.set(root, []);
      }
      result.get(root)!.push(key);
    }
    return result;
  }
}

export function buildClustersFromGroups(
  groups: Map<string, string[]>,
  memberByKey: Map<string, TopicClusterMember>,
): TopicCluster[] {
  return Array.from(groups.entries()).map(([root, keys], index) => ({
    id: `cluster_${index}_${root.slice(0, 8)}`,
    members: keys
      .map((key) => memberByKey.get(key))
      .filter((m): m is TopicClusterMember => m != null),
  }));
}

/** Pick canonical label without LLM: highest response_count, then shortest label. */
export function pickCanonicalLabelFromCluster(
  members: TopicClusterMember[],
): string {
  if (members.length === 0) return '';
  const sorted = [...members].sort((a, b) => {
    if (b.responseCount !== a.responseCount) {
      return b.responseCount - a.responseCount;
    }
    return a.topicText.length - b.topicText.length;
  });
  return sorted[0].topicText.trim();
}

export function normalizeTopicKey(topicText: string): string {
  return topicText.trim().toLowerCase();
}
