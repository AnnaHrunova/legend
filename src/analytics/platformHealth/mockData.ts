import {
  platformHealthTopics,
  type PlatformHealthPlatform,
  type PlatformHealthPriority,
  type PlatformHealthSource,
  type PlatformProjectId,
  type PlatformRelease,
} from './domain';

export type PlatformHealthItem = {
  id: string;
  subject: string;
  description: string;
  createdAt: string;
  source: PlatformHealthSource;
  platform?: PlatformHealthPlatform;
  rating?: 1 | 2 | 3 | 4 | 5;
  topicId: string;
  projectIds: PlatformProjectId[];
  priority: PlatformHealthPriority;
  status: string;
  appVersion?: string;
};

type Template = {
  subjects: string[];
  descriptions: string[];
};

const templates: Record<string, Template> = {
  'payment-failed': {
    subjects: ['Payment failed after confirmation', 'Money reserved but payment failed', 'Cannot retry bank payment'],
    descriptions: ['The payment flow confirms and then returns a failed state.', 'Customer sees reserved funds with no clear reversal date.'],
  },
  'card-declined': {
    subjects: ['Card declined at merchant', 'Virtual card declined online', 'Contactless payment rejected'],
    descriptions: ['Customer had sufficient balance but authorization failed.', 'The card payment was declined while other methods worked.'],
  },
  'esim-installation': {
    subjects: ["Can't install eSIM on iPhone", 'eSIM activation stuck', 'QR code fails during eSIM setup'],
    descriptions: ['The eSIM profile download does not complete.', 'Activation stalls after scanning the QR code.'],
  },
  'esim-refund': {
    subjects: ['Refund for unused eSIM not processed', 'Still waiting for eSIM refund', 'Charged for failed eSIM install'],
    descriptions: ['Customer paid for an eSIM that could not be activated.', 'Refund was expected but has not arrived.'],
  },
  'savings-balance': {
    subjects: ['Savings balance shows zero', 'Savings balance not updating', 'Interest missing from savings'],
    descriptions: ['The savings pot balance does not match transaction history.', 'The app shows stale savings information.'],
  },
  'documents-missing': {
    subjects: ['No documents after verification', 'Monthly statement never arrived', 'PDF statement missing'],
    descriptions: ['Documents were expected but not delivered.', 'Statement generation appears complete but delivery failed.'],
  },
  'push-notifications': {
    subjects: ['Push notifications not working', 'Payment alerts arrive late', 'No security alerts on device'],
    descriptions: ['Notification permissions are enabled but alerts do not arrive.', 'Payment notifications are delayed by hours.'],
  },
  'login-issues': {
    subjects: ['Login keeps failing', 'OTP code rejected', 'Biometric login loops'],
    descriptions: ['Customer cannot access the app because authentication loops.', 'One-time passcodes are rejected repeatedly.'],
  },
  'account-locked': {
    subjects: ['Account locked after failed login', 'Cannot unlock account', 'Security lock remains after verification'],
    descriptions: ['The account remains locked after verification.', 'Customer needs account access restored.'],
  },
  'verification-stuck': {
    subjects: ['Verification stuck in review', 'KYC pending for days', 'Identity check does not complete'],
    descriptions: ['Customer uploaded documents but verification remains pending.', 'Compliance review blocks account activation.'],
  },
  'app-crashes': {
    subjects: ['App crashes when I try to pay', 'App closes on launch', 'Crash after latest update'],
    descriptions: ['The mobile app crashes during a core flow.', 'Crash started after a recent release.'],
  },
  'slow-performance': {
    subjects: ['App loads very slowly', 'Transactions screen times out', 'Dashboard freezes after login'],
    descriptions: ['The app is slow across account and payment screens.', 'Performance issues block daily workflows.'],
  },
  'feature-budgeting': {
    subjects: ['Please add budgeting categories', 'Need monthly spending limits', 'Budgeting feature request'],
    descriptions: ['Reviewer wants stronger budgeting tools.', 'Customer asks for spending categories and limits.'],
  },
  'feature-virtual-cards': {
    subjects: ['Need better virtual card controls', 'Request for temporary virtual cards', 'Virtual card wallet request'],
    descriptions: ['Reviewer asks for more virtual card controls.', 'Customer wants temporary cards for online payments.'],
  },
};

const statuses = ['New', 'Open', 'Pending', 'Escalated', 'Solved'];
const versions = ['2.3.2', '2.4.0', '2.4.1', '2.5.0', '2.5.1'];

export function generatePlatformHealthItems(): PlatformHealthItem[] {
  const random = seededRandom(9127);
  const start = startOfMonth(monthsAgo(5));
  const end = new Date();
  const releases = platformHealthReleases(start);
  const items: PlatformHealthItem[] = [];
  let number = 30000;

  for (let day = 0; day <= daysBetween(start, end); day += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + day);
    const monthIndex = monthOffset(start, date);
    const volume = 20 + Math.floor(random() * 12) + monthIndex * 2;

    for (let index = 0; index < volume; index += 1) {
      const platform = random() < 0.56 ? 'android' : 'ios';
      const source = pickSource(platform, random);
      const topic = pickTopic(platform, monthIndex, day, releases, random);
      const createdAt = new Date(date);
      createdAt.setHours(Math.floor(random() * 24), Math.floor(random() * 60), 0, 0);
      const rating = source === 'support' ? undefined : pickRating(platform, topic.id, monthIndex, day, random);
      const priority = rating ? priorityFromRating(rating) : pickPriority(topic.id, platform, random);
      const template = templates[topic.id];

      items.push({
        id: `${source === 'support' ? 'SUP' : 'REV'}-${number}`,
        subject: pick(template.subjects, random),
        description: pick(template.descriptions, random),
        createdAt: createdAt.toISOString(),
        source,
        platform,
        ...(rating ? { rating } : {}),
        topicId: topic.id,
        projectIds: topic.projectIds,
        priority,
        status: pick(statuses, random),
        ...(source !== 'support' ? { appVersion: versionFor(createdAt, platform, releases) } : {}),
      });
      number += 1;
    }
  }

  return items;
}

export function platformHealthReleases(start = startOfMonth(monthsAgo(5))): PlatformRelease[] {
  return [
    { platform: 'android', version: '2.4.0', date: releaseDate(start, 74) },
    { platform: 'ios', version: '2.4.0', date: releaseDate(start, 80) },
    { platform: 'android', version: '2.5.0', date: releaseDate(start, 132) },
  ];
}

function pickSource(platform: PlatformHealthPlatform, random: () => number): PlatformHealthSource {
  if (random() < 0.44) return 'support';
  return platform === 'android' ? 'google_play' : 'app_store';
}

function pickTopic(
  platform: PlatformHealthPlatform,
  monthIndex: number,
  day: number,
  releases: PlatformRelease[],
  random: () => number,
) {
  const androidReleaseSpike = spike(day, dayIndex(releases.find((release) => release.platform === 'android' && release.version === '2.5.0')?.date));
  const iosAuthSpike = Math.exp(-Math.pow(day - 98, 2) / 90);
  const weights: Record<string, number> = {
    'payment-failed': platform === 'android' ? 1.1 + androidReleaseSpike * 4.4 + monthIndex * 0.22 : 0.85 + monthIndex * 0.06,
    'card-declined': platform === 'android' ? 0.95 + androidReleaseSpike * 1.7 : 0.78,
    'esim-installation': 1.05 + Math.max(0, 2 - monthIndex) * 0.34,
    'esim-refund': 0.72 + Math.max(0, monthIndex - 2) * 0.28,
    'savings-balance': 0.72 + monthIndex * 0.14,
    'documents-missing': 0.56,
    'push-notifications': platform === 'android' ? 1.45 + Math.sin(day / 10) * 0.35 : 0.62,
    'login-issues': platform === 'ios' ? 0.74 + iosAuthSpike * 3.8 : 0.82,
    'account-locked': platform === 'ios' ? 0.62 + iosAuthSpike * 1.4 : 0.58,
    'verification-stuck': 0.45,
    'app-crashes': platform === 'android' ? 0.84 + androidReleaseSpike * 2.6 : 0.54,
    'slow-performance': platform === 'android' ? 0.78 + monthIndex * 0.13 : 0.58,
    'feature-budgeting': platform === 'ios' ? 0.95 + monthIndex * 0.18 : 0.48,
    'feature-virtual-cards': platform === 'ios' ? 0.8 + monthIndex * 0.12 : 0.5,
  };
  const total = platformHealthTopics.reduce((sum, topic) => sum + weights[topic.id], 0);
  let cursor = random() * total;
  for (const topic of platformHealthTopics) {
    cursor -= weights[topic.id];
    if (cursor <= 0) return topic;
  }
  return platformHealthTopics[0];
}

function pickRating(platform: PlatformHealthPlatform, topicId: string, monthIndex: number, day: number, random: () => number): 1 | 2 | 3 | 4 | 5 {
  const severeTopic = ['payment-failed', 'card-declined', 'app-crashes', 'login-issues', 'account-locked'].includes(topicId);
  const recentAndroidPressure = platform === 'android' ? Math.max(0, monthIndex - 3) * 0.07 : 0;
  const releasePressure = platform === 'android' ? spike(day, 132) * 0.18 : 0;
  const lowRatingBias = (severeTopic ? 0.24 : 0.08) + recentAndroidPressure + releasePressure;
  return weightedPick([1, 2, 3, 4, 5] as const, [
    0.09 + lowRatingBias,
    0.15 + lowRatingBias,
    severeTopic ? 0.25 : 0.2,
    platform === 'ios' ? 0.34 : 0.24,
    platform === 'ios' ? 0.17 : 0.1,
  ], random);
}

function pickPriority(topicId: string, platform: PlatformHealthPlatform, random: () => number): PlatformHealthPriority {
  if (['payment-failed', 'card-declined', 'app-crashes', 'account-locked'].includes(topicId)) {
    return weightedPick(['low', 'normal', 'high', 'urgent'] as const, platform === 'android' ? [0.06, 0.24, 0.46, 0.24] : [0.1, 0.42, 0.36, 0.12], random);
  }
  return weightedPick(['low', 'normal', 'high', 'urgent'] as const, [0.28, 0.5, 0.18, 0.04], random);
}

function priorityFromRating(rating: 1 | 2 | 3 | 4 | 5): PlatformHealthPriority {
  if (rating <= 2) return 'high';
  if (rating === 3) return 'normal';
  return 'low';
}

function versionFor(date: Date, platform: PlatformHealthPlatform, releases: PlatformRelease[]) {
  const release = [...releases]
    .filter((item) => item.platform === platform && Date.parse(item.date) <= date.getTime())
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
  return release?.version ?? versions[0];
}

function releaseDate(start: Date, day: number) {
  const date = new Date(start);
  date.setDate(start.getDate() + day);
  return date.toISOString().slice(0, 10);
}

function dayIndex(value?: string) {
  if (!value) return 0;
  const start = startOfMonth(monthsAgo(5));
  return daysBetween(start, new Date(`${value}T00:00:00`));
}

function spike(day: number, center: number) {
  return Math.exp(-Math.pow(day - center, 2) / 120);
}

function weightedPick<T>(items: readonly T[], weights: number[], random: () => number): T {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = random() * total;
  for (let index = 0; index < items.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) return items[index];
  }
  return items[items.length - 1];
}

function pick<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)];
}

function monthsAgo(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
}

function startOfMonth(date: Date) {
  const next = new Date(date);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function daysBetween(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function monthOffset(start: Date, date: Date) {
  return (date.getFullYear() - start.getFullYear()) * 12 + date.getMonth() - start.getMonth();
}

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}
