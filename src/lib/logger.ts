export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  source?: string;
}

const MAX_LOGS = 100;
const logs: LogEntry[] = [];

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export const logger = {
  info(message: string, source?: string) {
    logs.unshift({
      id: generateId(),
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      source,
    });
    if (logs.length > MAX_LOGS) logs.pop();
    console.log(`[${source || 'app'}] ${message}`);
  },

  warn(message: string, source?: string) {
    logs.unshift({
      id: generateId(),
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      source,
    });
    if (logs.length > MAX_LOGS) logs.pop();
    console.warn(`[${source || 'app'}] ${message}`);
  },

  error(message: string, source?: string) {
    logs.unshift({
      id: generateId(),
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      source,
    });
    if (logs.length > MAX_LOGS) logs.pop();
    console.error(`[${source || 'app'}] ${message}`);
  },

  getAll(): LogEntry[] {
    return logs;
  },

  clear() {
    logs.length = 0;
  },
};

export default logger;