import posthog, { isPostHogEnabled } from './posthogClient';

export function track(eventName: string, properties?: Record<string, unknown>): void {
  if (import.meta.env.DEV) {
    console.log('[analytics:event]', eventName, properties);
  }

  if (isPostHogEnabled) {
    try {
      posthog.capture(eventName, properties);
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
