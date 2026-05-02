import type { TopicTicket } from './generateMockTickets';

export type TicketEmbedding = {
  ticketId: string;
  vector: number[];
};

const dimensions = 48;
const topicKeywords = [
  ['billing', 'payment', 'invoice', 'refund', 'charge', 'tax', 'renewal'],
  ['login', 'auth', 'sso', 'password', 'saml', 'factor', 'invite'],
  ['bug', 'crash', 'fails', 'regression', 'error', 'stuck', 'upload'],
  ['request', 'feature', 'workflow', 'customize', 'roadmap', 'permissions'],
  ['slow', 'latency', 'performance', 'timeout', 'loads', 'response'],
  ['integration', 'webhook', 'api', 'syncing', 'oauth', 'crm', 'slack'],
  ['notification', 'email', 'alerts', 'digest', 'push', 'delayed'],
  ['account', 'settings', 'workspace', 'owner', 'role', 'profile'],
  ['compliance', 'security', 'audit', 'retention', 'processor', 'legal'],
  ['reporting', 'dashboard', 'analytics', 'report', 'csv', 'chart'],
];

export function computeEmbeddings(tickets: TopicTicket[]): TicketEmbedding[] {
  const documentFrequencies = new Map<string, number>();
  const tokenized = tickets.map((ticket) => {
    const tokens = Array.from(new Set(tokenize(`${ticket.subject} ${ticket.description} ${ticket.tags.join(' ')}`)));
    tokens.forEach((token) => documentFrequencies.set(token, (documentFrequencies.get(token) ?? 0) + 1));
    return tokens;
  });

  return tickets.map((ticket, index) => {
    const tokens = tokenized[index];
    const vector = Array.from({ length: dimensions }, () => 0);

    for (const token of tokens) {
      const bucket = hash(token) % 32;
      const idf = Math.log((tickets.length + 1) / ((documentFrequencies.get(token) ?? 0) + 1)) + 1;
      vector[bucket] += idf;
    }

    topicKeywords.forEach((keywords, topicIndex) => {
      vector[32 + topicIndex] = keywords.reduce(
        (score, keyword) => score + (tokens.includes(keyword) ? 2 : 0),
        0,
      );
    });

    return {
      ticketId: ticket.id,
      vector: normalize(vector),
    };
  });
}

export function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function normalize(vector: number[]) {
  const length = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / length);
}

function hash(value: string) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }
  return result;
}

const stopWords = new Set([
  'the',
  'and',
  'for',
  'are',
  'but',
  'with',
  'after',
  'before',
  'this',
  'that',
  'from',
  'into',
  'not',
  'can',
  'cannot',
  'needs',
  'need',
  'customer',
  'users',
]);
