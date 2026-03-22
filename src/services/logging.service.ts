export interface AccessDeniedLog {
  userId: string;
  role: string;
  endpoint: string;
  method: string;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
}

/**
 * Log access denied events with structured JSON logging
 * Uses WARN severity level for security audit trail
 */
export function logAccessDenied(log: AccessDeniedLog): void {
  const logEntry = {
    level: 'WARN',
    event: 'ACCESS_DENIED',
    userId: log.userId,
    role: log.role,
    endpoint: log.endpoint,
    method: log.method,
    timestamp: log.timestamp.toISOString(),
    ...(log.ip && { ip: log.ip }),
    ...(log.userAgent && { userAgent: log.userAgent }),
  };

  console.warn(JSON.stringify(logEntry));
}
