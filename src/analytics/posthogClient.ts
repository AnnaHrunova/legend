import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;

export const isPostHogEnabled = Boolean(POSTHOG_KEY);

if (isPostHogEnabled) {
  posthog.init(POSTHOG_KEY, {
    api_host: 'https://eu.i.posthog.com',
    capture_pageview: false,
    autocapture: false,
  });
} else if (import.meta.env.DEV) {
  console.warn('PostHog key is missing');
}

export default posthog;
