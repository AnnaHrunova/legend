import posthog, { isPostHogEnabled } from './posthogClient';

export function track(eventName: string, properties?: Record<string, unknown>): void {
  if (import.meta.env.DEV) {
    console.log('[analytics]', eventName, properties);
  }

  if (isPostHogEnabled) {
    posthog.capture(eventName, properties);
  }
}

export function identify(userId: string, properties?: Record<string, unknown>): void {
  if (isPostHogEnabled) {
    posthog.identify(userId, properties);
  }
}
