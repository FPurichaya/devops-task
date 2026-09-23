export function safeMessage(error) {
  const message = error instanceof Error ? error.message : "unknown error";
  if (/[a-z][a-z0-9+.-]*:\/\//i.test(message)) return "dependency error";
  return message;
}
