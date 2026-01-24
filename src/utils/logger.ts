const LOG_LEVELS = {
  info: 1,
  warning: 2,
  error: 3,
  none: 4,
};

type LogLevel = keyof typeof LOG_LEVELS;

const CURRENT_LOG_LEVEL: LogLevel = 'info';

class Logger {
  private log(level: LogLevel, component: string, message: string, data?: unknown) {
    if (LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LOG_LEVEL]) {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [${level.toUpperCase()}] [${component}]`;
      if (level === 'error') {
        console.error(`${prefix} ${message}`, data || '');
      } else if (level === 'warning') {
        console.warn(`${prefix} ${message}`, data || '');
      } else {
        // eslint-disable-next-line no-console
        console.log(`${prefix} ${message}`, data || '');
      }
    }
  }

  info(component: string, message: string, data?: unknown) {
    this.log('info', component, message, data);
  }

  warning(component: string, message: string, data?: unknown) {
    this.log('warning', component, message, data);
  }

  error(component: string, message: string, data?: unknown) {
    this.log('error', component, message, data);
  }
}

export const logger = new Logger();
