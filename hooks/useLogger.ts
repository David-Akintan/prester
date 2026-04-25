import { useCallback } from 'react';

/**
 * Custom hook for structured logging with optional timestamps
 */
export function useLogger(namespace: string) {
  const log = useCallback(
    (level: 'info' | 'warn' | 'error', message: string, data?: unknown) => {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [${namespace}]`;
      
      if (level === 'error') {
        console.error(prefix, message, data);
      } else if (level === 'warn') {
        console.warn(prefix, message, data);
      } else {
        console.log(prefix, message, data);
      }
    },
    [namespace]
  );

  return {
    info: (message: string, data?: unknown) => log('info', message, data),
    warn: (message: string, data?: unknown) => log('warn', message, data),
    error: (message: string, data?: unknown) => log('error', message, data),
  };
}
