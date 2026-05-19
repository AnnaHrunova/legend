import type { VoiceActivityContext, VoiceAppContext } from '../domain/types';

export function buildMockActivityContext(appContext: VoiceAppContext, generatedAt: string): VoiceActivityContext {
  const baseTime = new Date(generatedAt).getTime();
  const at = (minutesAgo: number) => new Date(baseTime - minutesAgo * 60 * 1000).toISOString();
  const paymentId = appContext.entityContext?.paymentId ?? 'pay_8L4K91';
  const orderId = appContext.entityContext?.orderId ?? 'ord_20491';
  const paymentRelated = /payment|checkout|3ds|card/i.test(
    `${appContext.currentScreen}_${appContext.lastAction}_${appContext.recentErrors.join('_')}`,
  );

  return {
    generatedAt,
    lookbackMinutes: 45,
    lastSeenAt: at(1),
    riskLevel: paymentRelated ? 'high' : 'medium',
    summary: paymentRelated
      ? 'User tried checkout multiple times, reached 3DS, then hit payment timeout before starting voice support.'
      : 'User started voice support after repeated mobile app friction in the current screen.',
    lastActions: [
      {
        id: 'act_checkout_opened',
        occurredAt: at(14),
        source: 'mobile_app',
        label: 'Opened payment checkout',
        detail: `Screen ${appContext.currentScreen} opened for order ${orderId}.`,
        outcome: 'viewed',
      },
      {
        id: 'act_payment_submitted',
        occurredAt: at(11),
        source: 'mobile_app',
        label: 'Submitted card payment',
        detail: `User tapped ${appContext.lastAction}; payment id ${paymentId}.`,
        outcome: 'processing',
      },
      {
        id: 'act_3ds_opened',
        occurredAt: at(10),
        source: 'payments',
        label: '3DS challenge opened',
        detail: 'Payment provider requested customer authentication.',
        outcome: 'challenge_started',
      },
      {
        id: 'act_retry',
        occurredAt: at(6),
        source: 'mobile_app',
        label: 'Retried payment',
        detail: 'Second checkout attempt happened without leaving the payment screen.',
        outcome: 'failed',
      },
      {
        id: 'act_voice_started',
        occurredAt: at(1),
        source: 'support',
        label: 'Started in-app voice support',
        detail: 'User opened contextual voice support from checkout.',
        outcome: 'support_requested',
      },
    ],
    recentBackendEvents: [
      {
        id: 'evt_payment_auth_timeout',
        occurredAt: at(9),
        source: 'payments',
        label: 'Payment auth timed out',
        detail: '3DS auth callback exceeded the expected provider window.',
        outcome: 'timeout',
        metadata: {
          paymentId,
          provider: 'Stripe',
          status: 'requires_payment_method',
        },
      },
      {
        id: 'evt_risk_check_passed',
        occurredAt: at(12),
        source: 'backend',
        label: 'Risk check passed',
        detail: 'No fraud or compliance block found before provider auth.',
        outcome: 'passed',
      },
      {
        id: 'evt_push_failed',
        occurredAt: at(7),
        source: 'backend',
        label: 'Payment status push delayed',
        detail: 'Mobile app did not receive final payment state within 30 seconds.',
        outcome: 'delayed',
      },
    ],
    recentErrors: [
      ...appContext.recentErrors,
      'PAYMENT_PROVIDER_TIMEOUT',
      'PAYMENT_STATUS_SYNC_DELAYED',
    ],
    paymentContext: {
      provider: 'Stripe',
      method: 'card',
      transactionReference: paymentId,
      lastAttemptStatus: 'requires_payment_method',
      amount: '49.00',
      currency: 'EUR',
    },
    deviceContext: {
      platform: appContext.platform,
      appVersion: appContext.appVersion,
      locale: appContext.locale,
      network: 'wifi',
      deviceModel: appContext.platform === 'ios' ? 'iPhone 14' : 'Pixel 7',
    },
    linkedKnownIssue: {
      id: 'KI-PAY-3DS-TIMEOUT',
      title: '3DS timeout leaves checkout without clear recovery copy',
      status: 'investigating',
    },
    duplicateHints: [
      {
        ticketId: 'REV-2001',
        reason: 'Same checkout screen and 3DS timeout signature',
        status: 'Open',
      },
      {
        ticketId: 'TCK-1037',
        reason: 'Same payment provider and app version window',
        status: 'Pending',
      },
    ],
    backendSignals: [
      {
        id: 'payment_provider_detected',
        label: 'Payment provider detected',
        detail: 'Stripe appears in the latest payment backend event.',
      },
      {
        id: 'transaction_reference_detected',
        label: 'Transaction reference detected',
        detail: `${paymentId} is attached to the failed checkout attempt.`,
      },
      {
        id: 'known_issue_match',
        label: 'Known issue match',
        detail: 'Ticket matches KI-PAY-3DS-TIMEOUT.',
      },
      {
        id: 'possible_duplicates_found',
        label: 'Possible duplicates found',
        detail: 'Two recent tickets share the same payment failure pattern.',
      },
    ],
  };
}
