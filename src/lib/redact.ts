export function redactLogPII(logs: string): string {
  return logs
    // Auth headers
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/Basic\s+[A-Za-z0-9+/]+=*/gi, 'Basic [REDACTED]')
    // JSON credential fields (common names)
    .replace(
      /("(?:password|passwd|pwd|secret|token|api_key|apikey|access_key|private_key|client_secret|auth_token)"\s*:\s*)"[^"]*"/gi,
      '$1"[REDACTED]"',
    )
    // AWS access key IDs
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, '[AWS_KEY_REDACTED]')
    // AWS secret access keys (40-char base62 after assignment)
    .replace(/(aws_secret_access_key\s*[=:]\s*)[A-Za-z0-9/+]{40}/gi, '$1[REDACTED]')
    // Database / JDBC connection strings with embedded credentials
    .replace(
      /((jdbc|postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp)s?:\/\/)[^:@\s]+:[^@\s]+@/gi,
      '$1[REDACTED]:[REDACTED]@',
    )
    // SSH / PEM private keys (multi-line aware via block match)
    .replace(/-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g, '[PRIVATE_KEY_REDACTED]')
    // Email addresses
    .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
    // IPv4 — redact last two octets to preserve subnet context
    .replace(/\b(\d{1,3}\.\d{1,3})\.\d{1,3}\.\d{1,3}\b/g, '$1.x.x');
}
