import { resolveTopicSimilarityThreshold } from '../../ai/local-embedding-defaults';

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

/** Cosine similarity. Local embeddings are L2-normalized, so this is a dot product. */
export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / Math.sqrt(normA * normB);
}

export interface EmbeddedItem {
  key: string;
  embedding: number[];
}

/**
 * In-memory equivalent of Redis KNN + union-find topic clustering:
 * connect each item to its top-`k` neighbors above `threshold`, then merge.
 */
export function clusterByCosineSimilarity(
  items: EmbeddedItem[],
  options?: { k?: number; threshold?: number },
): Map<string, string[]> {
  const k = options?.k ?? parseInt(process.env.ANALYTICS_TOPIC_KNN_K ?? '15', 10);
  const threshold =
    options?.threshold ?? resolveTopicSimilarityThreshold();

  const uf = new UnionFind();
  for (const item of items) {
    uf.add(item.key);
  }

  for (const item of items) {
    const neighbors = items
      .filter((other) => other.key !== item.key)
      .map((other) => ({
        key: other.key,
        similarity: cosineSimilarity(item.embedding, other.embedding),
      }))
      .filter((n) => n.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);

    for (const neighbor of neighbors) {
      uf.union(item.key, neighbor.key);
    }
  }

  return uf.groups();
}

/** Spherical k-means on L2-normalized embeddings. Used to score embedding quality at a known k. */
export function clusterByKMeans(
  items: EmbeddedItem[],
  k: number,
  iterations = 40,
): Map<string, string[]> {
  if (items.length === 0 || k <= 0) return new Map();
  const dim = items[0].embedding.length;
  const step = Math.max(1, Math.floor(items.length / k));
  const centroids = Array.from({ length: k }, (_, i) => [
    ...items[Math.min(i * step, items.length - 1)].embedding,
  ]);
  let labels = new Array(items.length).fill(0);

  for (let iter = 0; iter < iterations; iter++) {
    labels = items.map((item) => {
      let best = 0;
      let bestSim = -Infinity;
      for (let c = 0; c < k; c++) {
        const sim = cosineSimilarity(item.embedding, centroids[c]);
        if (sim > bestSim) {
          bestSim = sim;
          best = c;
        }
      }
      return best;
    });
    for (let c = 0; c < k; c++) {
      const members = items.filter((_, i) => labels[i] === c);
      if (members.length === 0) continue;
      const next = new Array(dim).fill(0);
      for (const member of members) {
        for (let d = 0; d < dim; d++) next[d] += member.embedding[d];
      }
      const norm = Math.sqrt(next.reduce((sum, x) => sum + x * x, 0)) || 1;
      centroids[c] = next.map((x) => x / norm);
    }
  }

  const groups = new Map<string, string[]>();
  labels.forEach((label, i) => {
    const root = `k${label}`;
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(items[i].key);
  });
  return groups;
}

export function clusterPurity(
  predictedGroups: Map<string, string[]>,
  labelsByKey: Map<string, string>,
): number {
  let correct = 0;
  let total = 0;
  for (const members of predictedGroups.values()) {
    const counts = new Map<string, number>();
    for (const key of members) {
      const label = labelsByKey.get(key);
      if (!label) continue;
      counts.set(label, (counts.get(label) ?? 0) + 1);
      total += 1;
    }
    let majority = 0;
    for (const count of counts.values()) {
      if (count > majority) majority = count;
    }
    correct += majority;
  }
  return total === 0 ? 0 : correct / total;
}

/** Adjusted Rand index vs ground-truth labels. 1 = perfect, 0 ≈ random. */
export function adjustedRandIndex(
  predictedGroups: Map<string, string[]>,
  labelsByKey: Map<string, string>,
): number {
  const keys = Array.from(labelsByKey.keys());
  const predLabel = new Map<string, string>();
  for (const [root, members] of predictedGroups.entries()) {
    for (const key of members) {
      predLabel.set(key, root);
    }
  }

  let n00 = 0;
  let n11 = 0;
  let n10 = 0;
  let n01 = 0;
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const sameTrue = labelsByKey.get(keys[i]) === labelsByKey.get(keys[j]);
      const samePred = predLabel.get(keys[i]) === predLabel.get(keys[j]);
      if (sameTrue && samePred) n11 += 1;
      else if (!sameTrue && !samePred) n00 += 1;
      else if (sameTrue && !samePred) n10 += 1;
      else n01 += 1;
    }
  }

  const n = keys.length;
  if (n < 2) return 1;
  const combinations = (n * (n - 1)) / 2;
  const sumPredSame = n11 + n01;
  const sumTrueSame = n11 + n10;
  const expectedIndex = (sumPredSame * sumTrueSame) / combinations;
  const maxIndex = 0.5 * (sumPredSame + sumTrueSame);
  const denominator = maxIndex - expectedIndex;
  if (Math.abs(denominator) < 1e-12) return 1;
  return (n11 - expectedIndex) / denominator;
}
