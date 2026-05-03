import type { Priority, ReviewPlatform, ReviewRating, ReviewSource, TicketSource, TicketStatus } from '../../domain/types';
import { topics, type ProjectId } from './domain';

export type TopicAnalyticsTicket = {
  id: string;
  subject: string;
  description: string;
  createdAt: string;
  topicId: string;
  projectIds: ProjectId[];
  source: TicketSource;
  reviewSource?: ReviewSource;
  platform?: ReviewPlatform;
  rating?: ReviewRating;
  appVersion?: string;
  userName?: string;
  status: TicketStatus;
  priority: Priority;
};

type TicketTemplate = {
  subjects: string[];
  descriptions: string[];
};

const templates: Record<string, TicketTemplate> = {
  'esim-installation': {
    subjects: [
      "Can't install eSIM on iPhone",
      'eSIM QR code fails during setup',
      'Activation stuck after scanning eSIM',
      'eSIM profile cannot be downloaded',
    ],
    descriptions: [
      'Customer scans the QR code but the device never completes carrier activation.',
      'The eSIM profile download fails repeatedly on a new iPhone during onboarding.',
      'Customer changed phones and cannot reinstall the eSIM profile.',
    ],
  },
  'esim-refund': {
    subjects: [
      'Refund for unused eSIM not processed',
      'Charged twice for travel eSIM',
      'Customer wants eSIM refund after failed install',
      'Refund pending after cancelled eSIM order',
    ],
    descriptions: [
      'Customer paid for an eSIM that could not be activated and is asking for a refund.',
      'Refund was promised by support but the payment still appears as settled.',
      'Finance review is needed because the eSIM purchase was duplicated.',
    ],
  },
  'savings-balance': {
    subjects: [
      'Savings balance shows 0',
      'Interest not visible in savings account',
      'Savings pot balance is delayed',
      'Round-up savings balance is missing',
    ],
    descriptions: [
      'Customer can see deposits in transaction history but the savings balance has not updated.',
      'Savings interest appears missing after the monthly calculation window.',
      'The app shows a zero balance even though funds were moved into savings yesterday.',
    ],
  },
  'documents-missing': {
    subjects: [
      'No documents after verification',
      'Monthly statement email never arrived',
      'Tax document is missing from account',
      'PDF document download link expired',
    ],
    descriptions: [
      'Customer expected compliance documents by email but nothing arrived.',
      'Document generation completed but the delivery notification was not sent.',
      'The customer needs the PDF for an external bank review.',
    ],
  },
  'push-notifications': {
    subjects: [
      'Push notifications not working',
      'Payment alerts arrive hours late',
      'Device does not receive login alerts',
      'Duplicate push notifications for card payments',
    ],
    descriptions: [
      'Customer has notification permissions enabled but urgent alerts are not delivered.',
      'Push delivery is delayed for payment and security events.',
      'Customer receives duplicate card alerts for a single authorization.',
    ],
  },
  'payment-failed': {
    subjects: [
      'Payment failed after confirmation',
      'Transfer failed but money was reserved',
      'Bank payment cannot be retried',
      'Payment stuck in processing',
    ],
    descriptions: [
      'Customer confirmed the payment, but the app shows a failed status and no retry path.',
      'Funds appear reserved although the outgoing payment failed.',
      'Customer needs confirmation whether the transfer will settle or reverse.',
    ],
  },
  'card-declined': {
    subjects: [
      'Card declined at merchant',
      'Virtual card declined online',
      'Contactless card payment rejected',
      'Card authorization failed abroad',
    ],
    descriptions: [
      'Customer reports a card decline despite sufficient balance and unlocked card status.',
      'Merchant terminal rejected the payment while other cards worked.',
      'Card authorization needs review because customer is traveling.',
    ],
  },
  'login-issues': {
    subjects: [
      'Cannot log in with OTP',
      'Password reset link does not work',
      'Biometric login keeps failing',
      'Session expires immediately after login',
    ],
    descriptions: [
      'Customer cannot access the app because the one-time code is rejected.',
      'Password reset completes but the next login attempt still fails.',
      'Biometric authentication loops back to the login screen.',
    ],
  },
  'account-locked': {
    subjects: [
      'Account locked after failed login attempts',
      'Customer cannot unlock account',
      'Security lock remains after verification',
      'Account restricted after device change',
    ],
    descriptions: [
      'Customer completed identity checks but the account remains locked.',
      'Security policy locked the account after repeated failed login attempts.',
      'Customer changed devices and needs access restored.',
    ],
  },
  'transaction-missing': {
    subjects: [
      'Transaction missing from history',
      'Completed payment not visible in reports',
      'Incoming transfer does not appear',
      'Pending transaction disappeared',
    ],
    descriptions: [
      'Customer sees a bank confirmation but the transaction is missing from app history.',
      'Payment settled externally but reporting does not show the transaction.',
      'Operations team needs to reconcile the missing transaction record.',
    ],
  },
  'verification-stuck': {
    subjects: [
      'Verification stuck in review',
      'KYC check has been pending for days',
      'Identity verification does not complete',
      'Compliance review blocking account setup',
    ],
    descriptions: [
      'Customer uploaded documents but verification remains pending.',
      'KYC vendor response was received but the app still shows review in progress.',
      'Compliance review is blocking account activation.',
    ],
  },
  'app-crashes': {
    subjects: [
      'App crashes on startup',
      'App crashes when I try to pay',
      'Mobile app closes after latest update',
      'Crash during transaction confirmation',
    ],
    descriptions: [
      'Customer reports the mobile app closes unexpectedly after the latest release.',
      'Crash happens during payment confirmation and blocks the customer from completing the flow.',
      'The app opens briefly, freezes, and then exits without showing an error.',
    ],
  },
  'app-performance': {
    subjects: [
      'App loads very slowly',
      'Dashboard times out after login',
      'Transaction list takes too long to load',
      'Mobile app freezes during payment flow',
    ],
    descriptions: [
      'Customer reports slow loading across account and payment screens.',
      'The app becomes unresponsive when opening transaction history.',
      'Performance degradation is blocking daily payment workflows.',
    ],
  },
  'card-delivery': {
    subjects: [
      'Physical card delivery is late',
      'Card tracking link is missing',
      'Wrong delivery address for card',
      'Customer did not receive replacement card',
    ],
    descriptions: [
      'Customer ordered a card and has not received shipping updates.',
      'Delivery tracking was expected but no notification was sent.',
      'Replacement card appears shipped to an old address.',
    ],
  },
  'direct-debit': {
    subjects: [
      'Direct debit setup failed',
      'Bank mandate cannot be confirmed',
      'Direct debit payment was rejected',
      'Customer cannot connect bank for mandate',
    ],
    descriptions: [
      'Customer tries to create a direct debit mandate but bank authorization fails.',
      'Mandate appears created at the bank but not in the app.',
      'Recurring payment setup is blocked by account authorization.',
    ],
  },
  'report-export': {
    subjects: [
      'CSV report export has incorrect totals',
      'Report export is missing transactions',
      'PDF statement does not match dashboard',
      'Scheduled report failed overnight',
    ],
    descriptions: [
      'Customer exported a report and the totals do not match the dashboard.',
      'Several settled transactions are missing from CSV export.',
      'Scheduled reporting failed during the nightly generation window.',
    ],
  },
  'personal-data-update': {
    subjects: [
      'Cannot update legal address',
      'Name change is blocked after document upload',
      'Personal data update needs review',
      'Address document rejected incorrectly',
    ],
    descriptions: [
      'Customer submitted documents to update personal data but the change is blocked.',
      'Compliance review is needed before the account profile can be updated.',
      'Document management shows the upload but accounts still has old information.',
    ],
  },
};

const statuses: TicketStatus[] = ['New', 'Open', 'Pending', 'Waiting on customer', 'Escalated', 'Solved'];
const priorities: Priority[] = ['Low', 'Normal', 'High', 'Urgent'];
const versions = ['2.2.0', '2.2.4', '2.3.0', '2.3.1', '2.4.0', '2.4.2'];
const reviewUsers = ['Marta L.', 'James P.', 'Aiko T.', 'Ivan S.', 'Noah R.', 'Sofia M.', 'Daniel W.', 'Priya K.'];

export function generateTopicAnalyticsTickets(): TopicAnalyticsTicket[] {
  const random = seededRandom(186);
  const start = startOfMonth(monthsAgo(5));
  const end = new Date();
  const tickets: TopicAnalyticsTicket[] = [];
  let ticketNumber = 12000;

  for (let day = 0; day <= daysBetween(start, end); day += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + day);
    const monthIndex = monthOffset(start, date);
    const dailyVolume = 16 + Math.floor(random() * 11) + monthIndex * 2;

    for (let index = 0; index < dailyVolume; index += 1) {
      const topic = pickTopic(monthIndex, day, random);
      const template = templates[topic.id];
      const createdAt = new Date(date);
      createdAt.setHours(Math.floor(random() * 24), Math.floor(random() * 60), 0, 0);
      const source = pickSource(topic.id, monthIndex, day, random);
      const reviewSource = source === 'review' ? pickReviewSource(topic.id, random) : undefined;
      const rating = source === 'review' ? pickRating(topic.id, random) : undefined;
      const platform = reviewSource ? platformForReviewSource(reviewSource) : undefined;

      tickets.push({
        id: source === 'review' ? `REV-${ticketNumber}` : `PAY-${ticketNumber}`,
        subject: source === 'review'
          ? reviewSubject(topic.id, template, random)
          : pick(template.subjects, random),
        description: source === 'review'
          ? reviewDescription(topic.id, template, rating ?? 3, random)
          : pick(template.descriptions, random),
        createdAt: createdAt.toISOString(),
        topicId: topic.id,
        projectIds: topic.projectIds,
        source,
        ...(reviewSource ? { reviewSource } : {}),
        ...(platform ? { platform } : {}),
        ...(rating ? { rating } : {}),
        ...(source === 'review' ? { appVersion: pick(versions, random), userName: pick(reviewUsers, random) } : {}),
        status: weightedPick(statuses, [0.12, 0.28, 0.16, 0.1, 0.07, 0.27], random),
        priority: source === 'review' && rating ? priorityFromRating(rating) : weightedPick(priorities, priorityWeights(topic.id), random),
      });

      ticketNumber += 1;
    }
  }

  return tickets;
}

function pickSource(topicId: string, monthIndex: number, day: number, random: () => number): TicketSource {
  const reviewHeavyTopics = ['app-crashes', 'app-performance', 'payment-failed', 'card-declined', 'push-notifications', 'login-issues', 'esim-refund'];
  const releaseSpike = Math.exp(-Math.pow(day - 122, 2) / 130);
  const notificationSpike = topicId === 'push-notifications' && Math.sin(day / 9) > 0.82 ? 0.18 : 0;
  const laterRefundPressure = topicId === 'esim-refund' ? Math.max(0, monthIndex - 3) * 0.04 : 0;
  const base = reviewHeavyTopics.includes(topicId) ? 0.4 : 0.27;
  const probability = Math.min(0.58, base + releaseSpike * 0.12 + notificationSpike + laterRefundPressure);
  return random() < probability ? 'review' : 'support';
}

function pickReviewSource(topicId: string, random: () => number): ReviewSource {
  const androidHeavy = ['app-crashes', 'app-performance', 'push-notifications', 'payment-failed'];
  const googlePlayProbability = androidHeavy.includes(topicId) ? 0.58 : 0.48;
  return random() < googlePlayProbability ? 'google_play' : 'app_store';
}

function platformForReviewSource(reviewSource: ReviewSource): ReviewPlatform {
  return reviewSource === 'google_play' ? 'android' : 'ios';
}

function pickRating(topicId: string, random: () => number): ReviewRating {
  if (['payment-failed', 'card-declined', 'app-crashes', 'app-performance', 'login-issues', 'account-locked'].includes(topicId)) {
    return weightedPick([1, 2, 3, 4, 5] as ReviewRating[], [0.32, 0.34, 0.2, 0.1, 0.04], random);
  }

  if (['push-notifications', 'esim-installation', 'esim-refund', 'transaction-missing'].includes(topicId)) {
    return weightedPick([1, 2, 3, 4, 5] as ReviewRating[], [0.22, 0.34, 0.25, 0.14, 0.05], random);
  }

  if (['verification-stuck', 'documents-missing', 'personal-data-update'].includes(topicId)) {
    return weightedPick([1, 2, 3, 4, 5] as ReviewRating[], [0.14, 0.24, 0.36, 0.18, 0.08], random);
  }

  return weightedPick([1, 2, 3, 4, 5] as ReviewRating[], [0.07, 0.14, 0.28, 0.34, 0.17], random);
}

function priorityFromRating(rating: ReviewRating): Priority {
  if (rating <= 2) return 'Urgent';
  if (rating === 3) return 'High';
  return 'Normal';
}

function reviewSubject(topicId: string, template: TicketTemplate, random: () => number) {
  const overrides: Record<string, string[]> = {
    'app-crashes': ['App crashes when I try to pay', 'App keeps closing after update'],
    'app-performance': ['App crashes when I try to pay', 'App freezes on the transactions screen'],
    'payment-failed': ['Payment fails every time after confirmation', 'Money reserved but payment failed'],
    'esim-refund': ['Refund not received for unused eSIM', 'Still waiting for eSIM refund'],
    'push-notifications': ['Notifications are not working after update', 'No push alerts for payments'],
    'login-issues': ['Login keeps failing with OTP', 'Cannot get into my account'],
    'savings-balance': ['Savings balance shows zero in the app', 'Savings balance not updating'],
  };

  return pick(overrides[topicId] ?? template.subjects, random);
}

function reviewDescription(topicId: string, template: TicketTemplate, rating: ReviewRating, random: () => number) {
  const base = pick(template.descriptions, random);
  if (rating <= 2) {
    return `${base} This is blocking me and the app store review was left with a low rating.`;
  }

  if (rating === 3) {
    return `${base} The reviewer says the feature works sometimes but still needs attention.`;
  }

  if (topicId === 'savings-balance' || topicId === 'report-export') {
    return `${base} The reviewer likes the app overall but wants this fixed or improved.`;
  }

  return `${base} The reviewer reports a minor issue while continuing to use the app.`;
}

function pickTopic(monthIndex: number, day: number, random: () => number) {
  const releaseDay = 122;
  const paymentIncident = Math.exp(-Math.pow(day - releaseDay, 2) / 110);
  const notificationSpike = Math.sin(day / 9) > 0.82 ? 1.8 : 0;
  const launchPressure = Math.max(0, 3.4 - monthIndex * 0.7);

  const weights: Record<string, number> = {
    'esim-installation': 0.7 + launchPressure,
    'esim-refund': 0.65 + Math.max(0, monthIndex - 2) * 0.56,
    'savings-balance': 0.9 + monthIndex * 0.32,
    'documents-missing': 0.75 + notificationSpike * 0.4,
    'push-notifications': 0.7 + notificationSpike,
    'payment-failed': 0.92 + paymentIncident * 4.7,
    'card-declined': 0.9 + paymentIncident * 1.6,
    'login-issues': Math.max(0.62, 2.1 - monthIndex * 0.26),
    'account-locked': 0.82 + Math.sin(day / 17) * 0.12,
    'transaction-missing': 0.72 + paymentIncident * 1.15 + monthIndex * 0.1,
    'verification-stuck': 0.48,
    'app-crashes': 0.52 + paymentIncident * 3.6 + Math.max(0, monthIndex - 3) * 0.18,
    'app-performance': 0.68 + Math.max(0, monthIndex - 2) * 0.18,
    'card-delivery': 0.56 + Math.sin(day / 18) * 0.1,
    'direct-debit': 0.54 + Math.max(0, monthIndex - 3) * 0.18,
    'report-export': 0.52 + monthIndex * 0.12,
    'personal-data-update': 0.42,
  };

  const total = topics.reduce((sum, topic) => sum + weights[topic.id], 0);
  let cursor = random() * total;

  for (const topic of topics) {
    cursor -= weights[topic.id];
    if (cursor <= 0) return topic;
  }

  return topics[0];
}

function priorityWeights(topicId: string): number[] {
  if (['payment-failed', 'card-declined', 'app-crashes', 'account-locked'].includes(topicId)) {
    return [0.06, 0.34, 0.42, 0.18];
  }

  if (['verification-stuck', 'personal-data-update'].includes(topicId)) {
    return [0.12, 0.5, 0.3, 0.08];
  }

  if (['esim-installation', 'esim-refund', 'transaction-missing'].includes(topicId)) {
    return [0.1, 0.44, 0.34, 0.12];
  }

  return [0.22, 0.54, 0.19, 0.05];
}

function weightedPick<T>(items: T[], weights: number[], random: () => number): T {
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
