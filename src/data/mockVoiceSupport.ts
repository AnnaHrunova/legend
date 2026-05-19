import type { VoiceActivityContext, VoiceAppContext, VoiceTranscriptTurn } from '../domain/types';
import { buildMockActivityContext } from './mockActivityContext';

export const demoVoiceAppContext: VoiceAppContext = {
  userId: 'mobile-user-3281',
  fullName: 'Marta Kovalenko',
  email: 'marta.kovalenko@example.com',
  platform: 'ios',
  appVersion: '2.14.0',
  locale: 'en-US',
  currentScreen: 'payment_checkout',
  lastAction: 'submit_payment',
  recentErrors: ['PAYMENT_3DS_FAILED', 'CARD_AUTH_TIMEOUT'],
  entityContext: {
    paymentId: 'pay_8L4K91',
    orderId: 'ord_20491',
  },
};

export function demoVoiceActivityContext(now: string): VoiceActivityContext {
  return buildMockActivityContext(demoVoiceAppContext, now);
}

export function initialVoiceTranscript(now: string, activityContext?: VoiceActivityContext): VoiceTranscriptTurn[] {
  return [
    {
      id: crypto.randomUUID(),
      speaker: 'system',
      text: activityContext
        ? `In-app voice session started with authenticated mobile context and activity snapshot: ${activityContext.summary}`
        : 'In-app voice session started with authenticated mobile context.',
      createdAt: now,
      isFinal: true,
    },
    {
      id: crypto.randomUUID(),
      speaker: 'ai',
      text: 'I can see you were checking out and the last payment attempt failed during 3DS verification. Let me help with that.',
      createdAt: now,
      isFinal: true,
    },
  ];
}
