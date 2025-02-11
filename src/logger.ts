import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export class Logger {
  private static instance: Logger;
  private logStream: NodeJS.WritableStream;
  private consoleEnabled: boolean;

  private constructor() {
    const logDir = join(process.cwd(), 'logs');
    if (!existsSync(logDir)) {
      mkdirSync(logDir);
    }

    const logFile = join(logDir, `rpc-${new Date().toISOString().split('T')[0]}.log`);
    this.logStream = createWriteStream(logFile, { flags: 'a' });
    this.consoleEnabled = process.env.NODE_ENV !== 'production';
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatMessage(level: LogLevel, context: string, message: string, metadata?: any): string {
    const timestamp = new Date().toISOString();
    const metadataStr = metadata ? `\nMetadata: ${JSON.stringify(metadata, null, 2)}` : '';
    return `[${timestamp}] [${level}] [${context}] ${message}${metadataStr}\n`;
  }

  private write(level: LogLevel, context: string, message: string, metadata?: any) {
    const formattedMessage = this.formatMessage(level, context, message, metadata);
    this.logStream.write(formattedMessage);
    
    if (this.consoleEnabled) {
      const consoleMethod = level === LogLevel.ERROR ? 'error' : 
                          level === LogLevel.WARN ? 'warn' : 
                          level === LogLevel.DEBUG ? 'debug' : 'log';
      console[consoleMethod](formattedMessage.trim());
    }
  }

  debug(context: string, message: string, metadata?: any) {
    this.write(LogLevel.DEBUG, context, message, metadata);
  }

  info(context: string, message: string, metadata?: any) {
    this.write(LogLevel.INFO, context, message, metadata);
  }

  warn(context: string, message: string, metadata?: any) {
    this.write(LogLevel.WARN, context, message, metadata);
  }

  error(context: string, message: string, metadata?: any) {
    this.write(LogLevel.ERROR, context, message, metadata);
  }

  logRpcCall(daemon: string, method: string, params: any[], duration: number, success: boolean, error?: any) {
    const metadata = {
      daemon,
      method,
      params: this.sanitizeParams(params),
      durationMs: duration,
      success,
      ...(error && { error: this.sanitizeError(error) })
    };

    if (success) {
      this.info('RPC', `Successful call to ${method}`, metadata);
    } else {
      this.error('RPC', `Failed call to ${method}`, metadata);
    }
  }

  private sanitizeParams(params: any[]): any[] {
    return params.map(param => {
      if (typeof param === 'string' && this.containsSensitiveData(param)) {
        return '***REDACTED***';
      }
      return param;
    });
  }

  private sanitizeError(error: any): any {
    const errorObj = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error;

    return JSON.parse(JSON.stringify(errorObj, (key, value) => {
      if (typeof value === 'string' && this.containsSensitiveData(value)) {
        return '***REDACTED***';
      }
      return value;
    }));
  }

  private containsSensitiveData(str: string): boolean {
    // Add patterns for sensitive data
    const sensitivePatterns = [
      /password/i,
      /auth/i,
      /secret/i,
      /private/i,
      /key/i,
      /token/i
    ];
    return sensitivePatterns.some(pattern => pattern.test(str));
  }
}

export const logger = Logger.getInstance();