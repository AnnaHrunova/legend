import { tokenize } from './computeEmbeddings';
import type { TopicTicket } from './generateMockTickets';

export type TopicSummary = {
  id: number;
  label: string;
  keywords: string[];
  total: number;
  growthRate: number;
};

const labelRules = [
  { label: 'Billing Issues', keywords: ['billing', 'payment', 'invoice', 'refund', 'charge', 'tax'] },
  { label: 'Login Problems', keywords: ['login', 'auth', 'sso', 'password', 'saml', 'factor'] },
  { label: 'Bug Reports', keywords: ['bug', 'crash', 'fails', 'regression', 'error', 'stuck'] },
  { label: 'Feature Requests', keywords: ['feature', 'request', 'workflow', 'roadmap', 'customize'] },
  { label: 'Performance Issues', keywords: ['performance', 'slow', 'latency', 'timeout', 'response'] },
  { label: 'Integrations', keywords: ['integration', 'webhook', 'api', 'oauth', 'syncing'] },
  { label: 'Notifications', keywords: ['notification', 'email', 'alerts', 'digest', 'push'] },
  { label: 'Account Settings', keywords: ['account', 'settings', 'workspace', 'owner', 'role'] },
];

export function labelTopics(tickets: TopicTicket[], assignments: Map<string, number>): TopicSummary[] {
  const clusters = new Map<number, TopicTicket[]>();
  tickets.forEach((ticket) => {
    const cluster = assignments.get(ticket.id) ?? 0;
    clusters.set(cluster, [...(clusters.get(cluster) ?? []), ticket]);
  });

  return Array.from(clusters.entries())
    .map(([id, clusterTickets]) => {
      const keywords = topKeywords(clusterTickets);
      return {
        id,
        label: labelFromKeywords(keywords),
        keywords,
        total: clusterTickets.length,
        growthRate: growthRate(clusterTickets),
      };
    })
    .sort((a, b) => a.id - b.id);
}

function topKeywords(tickets: TopicTicket[]) {
  const counts = new Map<string, number>();
  tickets.forEach((ticket) => {
    tokenize(`${ticket.subject} ${ticket.description} ${ticket.tags.join(' ')}`).forEach((token) => {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([keyword]) => keyword);
}

function labelFromKeywords(keywords: string[]) {
  const best = labelRules
    .map((rule) => ({
      label: rule.label,
      score: rule.keywords.reduce((sum, keyword) => sum + (keywords.includes(keyword) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score)[0];

  return best.score > 0 ? best.label : titleCase(keywords.slice(0, 2).join(' '));
}

function growthRate(tickets: TopicTicket[]) {
  const sorted = [...tickets].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const midpoint = Math.floor(sorted.length / 2);
  const first = Math.max(1, midpoint);
  const second = Math.max(0, sorted.length - midpoint);
  return Math.round(((second - first) / first) * 100);
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

