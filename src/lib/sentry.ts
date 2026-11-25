// Sentry error and performance monitoring, kept inside Sentry's free plan.
// - Runs only in production builds with VITE_SENTRY_DSN set, so local dev
//   never uses quota or raises alerts.
// - No session replay (AGENTS.md §6, CIPA); emails and IPs are stripped.
import * as Sentry from '@sentry/react';

// Background Google traffic (auth, Firestore long-poll) makes slow, noisy
// spans that tell us nothing about the app.
const NOISY_HOSTS = /(^|\.)google\.com$|(^|\.)googleapis\.com$/;

export function isNoisyRequest(url: string): boolean {
  try {
    return NOISY_HOSTS.test(new URL(url, 'http://localhost').hostname);
  } catch {
    return false;
  }
}

export const MAX_EVENTS_PER_SESSION = 20;

export function createBeforeSend(maxEvents = MAX_EVENTS_PER_SESSION) {
  let sentCount = 0;
  return (event: Sentry.ErrorEvent): Sentry.ErrorEvent | null => {
    if (sentCount >= maxEvents) return null;
    sentCount += 1;
    if (event.user) {
      delete event.user.email;
      delete event.user.username;
      delete event.user.ip_address;
    }
    return event;
  };
}

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!import.meta.env.PROD || !dsn) return;

  Sentry.init({
    dsn,
    environment: 'production',
    integrations: [
      Sentry.browserTracingIntegration({
        shouldCreateSpanForRequest: (url) => !isNoisyRequest(url),
      }),
    ],
    // 20% of page loads; a small team stays far below the 5M span free quota.
    tracesSampleRate: 0.2,
    beforeSend: createBeforeSend(),
  });
}
