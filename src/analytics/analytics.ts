import posthog, { isPostHogEnabled } from './posthogClient';
import { getTesterProfile, testerAnalyticsProperties } from './testerProfile';

export function track(eventName: string, properties?: Record<string, unknown>): void {
  const enrichedProperties = {
    ...testerAnalyticsProperties(getTesterProfile()),
    ...properties,
  };

  if (import.meta.env.DEV) {
    console.log('[analytics:event]', eventName, enrichedProperties);
  }

  if (isPostHogEnabled) {
    try {
      posthog.capture(eventName, enrichedProperties);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[analytics:event]', eventName, error);
      }
    }
  }
}

export function identify(userId: string, properties?: Record<string, unknown>): void {
  if (isPostHogEnabled) {
    posthog.identify(userId, properties);
  }
}
