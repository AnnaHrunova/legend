import type { TicketEmbedding } from './computeEmbeddings';

export type ClusterResult = {
  assignments: Map<string, number>;
  centroids: number[][];
};

export function clusterTopics(embeddings: TicketEmbedding[], clusterCount = 8): ClusterResult {
  const step = Math.max(1, Math.floor(embeddings.length / clusterCount));
  const centroids = Array.from({ length: clusterCount }, (_, index) => [
    ...embeddings[Math.min(index * step, embeddings.length - 1)].vector,
  ]);
  const assignments = new Map<string, number>();

  for (let iteration = 0; iteration < 14; iteration += 1) {
    for (const embedding of embeddings) {
      assignments.set(embedding.ticketId, nearestCentroid(embedding.vector, centroids));
    }

    for (let cluster = 0; cluster < clusterCount; cluster += 1) {
      const members = embeddings.filter((embedding) => assignments.get(embedding.ticketId) === cluster);
      if (!members.length) continue;
      centroids[cluster] = average(members.map((member) => member.vector));
    }
  }

  return { assignments, centroids };
}

function nearestCentroid(vector: number[], centroids: number[][]) {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  centroids.forEach((centroid, index) => {
    const distance = squaredDistance(vector, centroid);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function squaredDistance(a: number[], b: number[]) {
  return a.reduce((sum, value, index) => {
    const delta = value - b[index];
    return sum + delta * delta;
  }, 0);
}

function average(vectors: number[][]) {
  const result = Array.from({ length: vectors[0].length }, () => 0);
  vectors.forEach((vector) => {
    vector.forEach((value, index) => {
      result[index] += value;
    });
  });
  return result.map((value) => value / vectors.length);
}
