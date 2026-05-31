// Maps raw axios/network errors to a single, user-safe message.
//
// Never show a raw backend error or stack trace to a patient. Screens can call
// getErrorMessage(err) for an Alert, or read err.userMessage which the response
// interceptor attaches automatically.

const DEFAULT_MESSAGE = 'Something went wrong. Please try again.';

const STATUS_MESSAGES = {
  400: 'That request could not be processed. Please check your details and try again.',
  401: 'Your session has expired. Please sign in again.',
  403: "You don't have permission to do that.",
  404: 'We could not find what you were looking for.',
  408: 'The request timed out. Please try again.',
  409: 'That action conflicts with the current state. Please refresh and retry.',
  413: 'The file is too large to upload.',
  422: 'Some of the information provided was invalid.',
  429: 'Too many attempts. Please wait a moment and try again.',
  500: 'Our servers had a problem. Please try again shortly.',
  502: 'The service is temporarily unavailable. Please try again shortly.',
  503: 'The service is temporarily unavailable. Please try again shortly.',
};

export function getErrorMessage(error) {
  // No response = network/timeout/cancelled.
  if (error?.code === 'ERR_CANCELED') return null; // caller cancelled; not user-facing
  if (error?.message === 'Network Error' || error?.code === 'ERR_NETWORK') {
    return 'No internet connection. Please check your network and try again.';
  }
  if (error?.code === 'ECONNABORTED') {
    return 'The request timed out. Please try again.';
  }

  const status = error?.response?.status;
  if (status && STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];

  // Some endpoints return a human message in the body — surface it only if it
  // looks safe (a short string), otherwise fall back to the generic message.
  const serverMsg = error?.response?.data?.message;
  if (typeof serverMsg === 'string' && serverMsg.length > 0 && serverMsg.length < 160) {
    return serverMsg;
  }

  return DEFAULT_MESSAGE;
}

export default getErrorMessage;
