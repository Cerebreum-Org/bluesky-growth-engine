import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    console.log('SENTRY_DSN not set, skipping Sentry initialization');
    return;
  }

  Sentry.init({
    dsn,
    integrations: [nodeProfilingIntegration()],
    // Performance Monitoring
    tracesSampleRate: 1.0, // Capture 100% of transactions
    // Set sampling rate for profiling
    profilesSampleRate: 1.0,
    environment: process.env.NODE_ENV || 'production',
  });

  console.log('Sentry initialized');
}

export { Sentry };
