import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = 'https://eu.i.posthog.com';

export const isPostHogEnabled = Boolean(POSTHOG_KEY);

if (isPostHogEnabled) {
  try {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: false,
      autocapture: false,
      request_batching: false,
    });

    if (import.meta.env.DEV) {
      console.log('[analytics:init]', {
        enabled: true,
        apiHost: POSTHOG_HOST,
        keyPresent: true,
      });
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[analytics:init]', error);
    }
  }
} else if (import.meta.env.DEV) {
  console.warn('[analytics:disabled] VITE_POSTHOG_KEY is missing');
}

export default posthog;
