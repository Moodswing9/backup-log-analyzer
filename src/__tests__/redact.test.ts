import { describe, it, expect } from 'vitest';
import { redactLogPII } from '../lib/redact';

describe('redactLogPII', () => {
  it('redacts Bearer tokens', () => {
    const result = redactLogPII('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc.def');
    expect(result).toBe('Authorization: Bearer [REDACTED]');
  });

  it('redacts Basic auth tokens', () => {
    const result = redactLogPII('Authorization: Basic dXNlcjpwYXNz');
    expect(result).toBe('Authorization: Basic [REDACTED]');
  });

  it('redacts JSON password fields', () => {
    const result = redactLogPII('{"password": "s3cr3t", "user": "admin"}');
    expect(result).toContain('"[REDACTED]"');
    expect(result).not.toContain('s3cr3t');
  });

  it('redacts JSON token fields', () => {
    const result = redactLogPII('{"token": "abc123xyz", "other": "fine"}');
    expect(result).not.toContain('abc123xyz');
    expect(result).toContain('[REDACTED]');
  });

  it('redacts JSON api_key fields', () => {
    const result = redactLogPII('{"api_key": "secret-key-value"}');
    expect(result).not.toContain('secret-key-value');
  });

  it('redacts AWS access key IDs', () => {
    const result = redactLogPII('Using key AKIAIOSFODNN7EXAMPLE for auth');
    expect(result).toContain('[AWS_KEY_REDACTED]');
    expect(result).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });

  it('redacts aws_secret_access_key assignments', () => {
    const result = redactLogPII('aws_secret_access_key = abcdefghijklmnopqrstuvwxyz0123456789abcd');
    expect(result).toContain('[REDACTED]');
    expect(result).not.toContain('abcdefghijklmno');
  });

  it('redacts JDBC connection strings with credentials', () => {
    const result = redactLogPII('jdbc:postgresql://myuser:mypassword@dbhost:5432/mydb');
    expect(result).toContain('[REDACTED]:[REDACTED]@');
    expect(result).not.toContain('mypassword');
    expect(result).not.toContain('myuser');
  });

  it('redacts postgres connection strings', () => {
    const result = redactLogPII('postgres://admin:secret123@localhost:5432/appdb');
    expect(result).toContain('[REDACTED]:[REDACTED]@');
    expect(result).not.toContain('secret123');
  });

  it('redacts PEM private key blocks', () => {
    const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAK\n-----END RSA PRIVATE KEY-----';
    expect(redactLogPII(pem)).toBe('[PRIVATE_KEY_REDACTED]');
  });

  it('redacts EC private key blocks', () => {
    const pem = '-----BEGIN EC PRIVATE KEY-----\nMHQCAQEE\n-----END EC PRIVATE KEY-----';
    expect(redactLogPII(pem)).toBe('[PRIVATE_KEY_REDACTED]');
  });

  it('redacts email addresses', () => {
    const result = redactLogPII('User admin@example.com triggered job');
    expect(result).toContain('[EMAIL]');
    expect(result).not.toContain('admin@example.com');
  });

  it('redacts last two IPv4 octets', () => {
    const result = redactLogPII('Connection from 192.168.10.254');
    expect(result).toContain('192.168.x.x');
    expect(result).not.toContain('192.168.10.254');
  });

  it('preserves subnet context in IPv4 redaction', () => {
    const result = redactLogPII('Server at 10.20.30.40');
    expect(result).toContain('10.20.x.x');
  });

  it('preserves text with no PII', () => {
    const clean = 'Backup job completed successfully at 14:30 UTC';
    expect(redactLogPII(clean)).toBe(clean);
  });

  it('redacts multiple credential types in one string', () => {
    const input = 'Bearer abc123token and admin@corp.com at 10.20.30.40';
    const result = redactLogPII(input);
    expect(result).toContain('Bearer [REDACTED]');
    expect(result).toContain('[EMAIL]');
    expect(result).toContain('10.20.x.x');
  });
});
