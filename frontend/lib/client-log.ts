export type ClientLogLevel = 'debug' | 'info' | 'warn' | 'error';

const SOURCE = 'lorenzo_frontend';

export function clientLog(level: ClientLogLevel, event: string, fields?: Record<string, unknown>): void {
  const payload = {
    timestamp: new Date().toISOString(),
    source: SOURCE,
    event,
    ...fields,
  };
  switch (level) {
    case 'debug':
      console.debug(payload);
      break;
    case 'info':
      console.info(payload);
      break;
    case 'warn':
      console.warn(payload);
      break;
    case 'error':
      console.error(payload);
      break;
  }
}

export function safelyVoid(scope: string, p: Promise<unknown>): void {
  void p.catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    clientLog('error', 'async_rejection_guard', {
      scope,
      message,
      ...(err instanceof Error && err.stack ? { stack: err.stack } : {}),
    });
  });
}
