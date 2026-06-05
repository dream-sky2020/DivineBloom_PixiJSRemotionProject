export type DebugLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface DebugCommand {
  level: DebugLevel;
  source: string;
  message: string;
  detail?: Record<string, unknown>;
}

const DEBUG_LOG_ENDPOINT = 'http://127.0.0.1:8787/debug/log';

export function sendDebugCommand(command: DebugCommand): void {
  if (typeof fetch !== 'function') return;

  void fetch(DEBUG_LOG_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(command),
  });
}
