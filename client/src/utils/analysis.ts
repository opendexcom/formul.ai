import { FormData, QuestionType } from '../services/formsService';

export type SentimentLabel = 'positive' | 'neutral' | 'negative';

export interface SentimentResult {
  score: number; // -1..1
  label: SentimentLabel;
}

export interface ClusterResult {
  terms: string[];
  indices: number[]; // indices of items in the input text array
  samples: string[];
}

export interface InsightsSummary {
  responseCount: number;
  completionAvgPct: number;
  topOptions: Array<{ option: string; questionTitle: string; count: number }>; // top 5
}

// Lightweight bilingual (EN/PL) sentiment lexicon (very small; extend as needed)
const POSITIVE = new Set([
  'good','great','excellent','love','like','helpful','useful','clear','easy','fast','super','amazing','awesome','happy','satisfied','polecam','dobry','świetny','super','fajny','zadowolony','pozytywny'
]);
const NEGATIVE = new Set([
  'bad','poor','hate','dislike','confusing','hard','slow','terrible','awful','bug','error','issue','problem','unhappy','unsatisfied','worst','niezadowolony','zły','słaby','fatalny','tragiczny','negatywny','problem','błąd'
]);

const STOP = new Set([
  // EN stopwords
  'the','a','an','and','or','to','of','in','on','for','with','is','are','it','this','that','be','as','at','from','by','do','does','did','was','were','have','has','had','not','no','yes','but','if','then','so','my','your','our','their','me','us','them','about','into','over','under','more','less','very','too','also','than','you','we','they','i',
  // PL stopwords (subset)
  'jak','że','i','oraz','ale','to','na','w','o','u','z','do','po','od','za','się','jest','są','być','było','była','mam','nie','tak','co','czy','też','już','bardzo','mnie'
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter(t => t && t.length >= 2 && !STOP.has(t));
}

export function computeSentiment(text: string): SentimentResult {
  const toks = tokenize(text);
  if (toks.length === 0) return { score: 0, label: 'neutral' };
  let score = 0;
  toks.forEach(t => {
    if (POSITIVE.has(t)) score += 1;
    if (NEGATIVE.has(t)) score -= 1;
  });
  const norm = Math.max(1, toks.length / 5); // normalize by rough sentence length
  const s = Math.max(-1, Math.min(1, score / norm));
  const label: SentimentLabel = s > 0.2 ? 'positive' : s < -0.2 ? 'negative' : 'neutral';
  return { score: s, label };
}

export function sentimentDistribution(texts: string[]) {
  const dist: Record<SentimentLabel, number> = { positive: 0, neutral: 0, negative: 0 };
  const scored: Array<{ text: string; score: number; label: SentimentLabel }> = [];
  texts.forEach(t => {
    const s = computeSentiment(t);
    dist[s.label] += 1;
    scored.push({ text: t, score: s.score, label: s.label });
  });
  const topPos = scored
    .filter(s => s.label === 'positive')
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(s => s.text);
  const topNeg = scored
    .filter(s => s.label === 'negative')
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map(s => s.text);
  return { dist, topPos, topNeg };
}

// Simple k-means like clustering over tf-idf vectors (very small data only)
function tf(texts: string[]): Array<Map<string, number>> {
  return texts.map(t => {
    const toks = tokenize(t);
    const m = new Map<string, number>();
    toks.forEach(tok => m.set(tok, (m.get(tok) || 0) + 1));
    return m;
  });
}

function idf(docs: Array<Map<string, number>>): Map<string, number> {
  const df = new Map<string, number>();
  docs.forEach(doc => {
    for (const term of doc.keys()) df.set(term, (df.get(term) || 0) + 1);
  });
  const N = docs.length || 1;
  const res = new Map<string, number>();
  for (const [term, d] of df.entries()) {
    res.set(term, Math.log((N + 1) / (d + 1)) + 1);
  }
  return res;
}

function toVectors(docs: Array<Map<string, number>>, idfMap: Map<string, number>): { vocab: string[]; vecs: number[][] } {
  const vocab = Array.from(idfMap.keys());
  const vecs = docs.map(doc => {
    const v = new Array(vocab.length).fill(0);
    vocab.forEach((term, i) => {
      const tfv = doc.get(term) || 0;
      const idfv = idfMap.get(term) || 0;
      v[i] = tfv * idfv;
    });
    // L2 normalize
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map(x => x / norm);
  });
  return { vocab, vecs };
}

function cosine(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function kmeansCluster(texts: string[], kAuto = true, kFixed = 0): ClusterResult[] {
  const docs = tf(texts);
  if (docs.length === 0) return [];
  const idfMap = idf(docs);
  const { vocab, vecs } = toVectors(docs, idfMap);

  const k = kAuto ? Math.max(2, Math.min(5, Math.round(Math.sqrt(vecs.length)))) : Math.max(1, kFixed);
  // init centers as first k vectors
  const centers = vecs.slice(0, k).map(v => [...v]);
  const assign = new Array(vecs.length).fill(0);

  for (let iter = 0; iter < 8; iter++) {
    // assignment step
    for (let i = 0; i < vecs.length; i++) {
      let best = 0, bestSim = -Infinity;
      for (let c = 0; c < centers.length; c++) {
        const sim = cosine(vecs[i], centers[c]);
        if (sim > bestSim) { bestSim = sim; best = c; }
      }
      assign[i] = best;
    }
    // update step
    const sums: number[][] = new Array(k).fill(0).map(() => new Array(vocab.length).fill(0));
    const counts = new Array(k).fill(0);
    for (let i = 0; i < vecs.length; i++) {
      const a = assign[i];
      counts[a]++;
      for (let j = 0; j < vocab.length; j++) sums[a][j] += vecs[i][j];
    }
    for (let c = 0; c < k; c++) {
      const norm = Math.sqrt(sums[c].reduce((s, x) => s + x * x, 0)) || 1;
      centers[c] = sums[c].map(x => x / norm);
    }
  }

  // build clusters
  const clusters: ClusterResult[] = new Array(k).fill(0).map(() => ({ terms: [], indices: [], samples: [] }));
  for (let i = 0; i < vecs.length; i++) clusters[assign[i]].indices.push(i);

  // top terms per cluster
  for (let c = 0; c < k; c++) {
    const termWeights = new Array(vocab.length).fill(0);
    for (const idx of clusters[c].indices) {
      for (let j = 0; j < vocab.length; j++) termWeights[j] += vecs[idx][j];
    }
    const top = termWeights
      .map((w, i) => ({ term: vocab[i], w }))
      .sort((a, b) => b.w - a.w)
      .slice(0, 6)
      .map(x => x.term);
    clusters[c].terms = top;
    clusters[c].samples = clusters[c].indices.slice(0, 3).map(i => texts[i]);
  }

  return clusters.filter(c => c.indices.length > 0);
}

export interface OverallClimate {
  positivityScore: number; // 0-100
  sentimentBreakdown: Record<SentimentLabel, number>;
  dominantTendency: string;
  semanticAxis?: { left: string; right: string; position: number };
}

export function computeOverallClimate(form: FormData, responses: any[]): OverallClimate {
  const textTypes = new Set([QuestionType.TEXT, QuestionType.TEXTAREA]);
  const texts: string[] = [];
  
  for (const q of form.questions) {
    if (!textTypes.has(q.type)) continue;
    for (const r of responses) {
      const v = r.answers.find((a: any) => a.questionId === q.id)?.value;
      if (!v) continue;
      const s = String(v).trim();
      if (s) texts.push(s);
    }
  }

  if (texts.length === 0) {
    return {
      positivityScore: 50,
      sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
      dominantTendency: 'neutral',
    };
  }

  const { dist } = sentimentDistribution(texts);
  const total = dist.positive + dist.neutral + dist.negative || 1;
  const positivityScore = Math.round(((dist.positive + dist.neutral * 0.5) / total) * 100);

  // Dominant tendency: positive-negative balance
  const tendencyValue = ((dist.positive - dist.negative) / total);
  const dominantTendency = tendencyValue > 0.2 ? 'positive' : tendencyValue < -0.2 ? 'negative' : 'neutral';

  // Try to detect semantic axes from clusters
  let semanticAxis: { left: string; right: string; position: number } | undefined;
  if (texts.length >= 5) {
    const clusters = kmeansCluster(texts);
    if (clusters.length >= 2) {
      // Simple heuristic: first cluster terms vs second
      semanticAxis = {
        left: clusters[0].terms.slice(0, 2).join('/'),
        right: clusters[1].terms.slice(0, 2).join('/'),
        position: (tendencyValue + 1) / 2 // normalize -1..1 to 0..1
      };
    }
  }

  return {
    positivityScore,
    sentimentBreakdown: dist,
    dominantTendency,
    semanticAxis,
  };
}

export function summarize(form: FormData, responses: any[]): InsightsSummary {
  const totalQuestions = form.questions.length || 1;
  const totals = responses.map((r: any) => {
    return form.questions.reduce((cnt, q) => {
      const v = r.answers.find((a: any) => a.questionId === q.id)?.value;
      return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0) ? cnt + 1 : cnt;
    }, 0);
  });
  const answered = totals.reduce((s: number, n: number) => s + n, 0);
  const completionAvgPct = responses.length ? Math.round((answered / (responses.length * totalQuestions)) * 100) : 0;

  const counts = new Map<string, { count: number; questionTitle: string }>();
  for (const q of form.questions) {
    if (![QuestionType.MULTIPLE_CHOICE, QuestionType.DROPDOWN, QuestionType.CHECKBOX].includes(q.type)) continue;
    for (const r of responses) {
      const v = r.answers.find((a: any) => a.questionId === q.id)?.value;
      if (v === undefined || v === null || v === '') continue;
      if (Array.isArray(v)) v.forEach(x => {
        const key = `${q.id}::${String(x)}`;
        counts.set(key, { count: (counts.get(key)?.count || 0) + 1, questionTitle: q.title });
      });
      else {
        const key = `${q.id}::${String(v)}`;
        counts.set(key, { count: (counts.get(key)?.count || 0) + 1, questionTitle: q.title });
      }
    }
  }
  const topOptions = Array.from(counts.entries())
    .map(([key, { count, questionTitle }]) => ({ option: key.split('::')[1], questionTitle, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return { responseCount: responses.length, completionAvgPct, topOptions };
}
