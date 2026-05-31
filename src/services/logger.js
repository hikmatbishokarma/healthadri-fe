// Centralized logger.
//
// Use this instead of console.* directly. In development it prints to the
// console; in production it stays silent (so we don't leak PHI / tokens into
// device logs) but routes to `report()` — the single seam where a crash
// reporter like Sentry would be wired in later.

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

function format(scope, args) {
  return scope ? [`[${scope}]`, ...args] : args;
}

export const logger = {
  debug(scope, ...args) {
    if (isDev) console.log(...format(scope, args));
  },
  info(scope, ...args) {
    if (isDev) console.info(...format(scope, args));
  },
  warn(scope, ...args) {
    if (isDev) console.warn(...format(scope, args));
  },
  error(scope, ...args) {
    if (isDev) console.error(...format(scope, args));
    // Hook for production crash reporting (Sentry, etc.) — no-op for now.
    report(scope, args);
  },
};

// eslint-disable-next-line no-unused-vars
function report(scope, args) {
  // Intentionally empty. Wire up Sentry.captureException here when added.
}

export default logger;
