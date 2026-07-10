import { describe, it, expect } from 'vitest';
import { classifyLog, TAXONOMY } from '../lib/error-taxonomy';

describe('classifyLog', () => {
  it('matches PPDM-0001 vProxy unreachable', () => {
    const result = classifyLog('Error: vProxy unreachable at 10.20.x.x');
    expect(result.matched).toBe(true);
    expect(result.match?.errorCode).toBe('PPDM-0001');
    expect(result.confidence).toBe('high');
  });

  it('matches PPDM-0002 lockbox access denied', () => {
    const result = classifyLog('CRITICAL: lockbox access denied for credential store');
    expect(result.matched).toBe(true);
    expect(result.match?.errorCode).toBe('PPDM-0002');
  });

  it('matches PPDM-0003 storage unit full', () => {
    const result = classifyLog('Backup failed: storage unit full, no space left on device');
    expect(result.matched).toBe(true);
    expect(result.match?.errorCode).toBe('PPDM-0003');
    expect(result.match?.severity).toBe('CRITICAL');
  });

  it('matches PPDM-0004 backup window expired', () => {
    const result = classifyLog('WARNING: backup window expired — schedule missed');
    expect(result.matched).toBe(true);
    expect(result.match?.errorCode).toBe('PPDM-0004');
  });

  it('matches PPDM-0005 auth token failure', () => {
    const result = classifyLog('401 Unauthorized: token expired, authentication failed');
    expect(result.matched).toBe(true);
    expect(result.match?.errorCode).toBe('PPDM-0005');
  });

  it('matches PPDM-0006 kubernetes namespace not found', () => {
    const result = classifyLog('kubernetes namespace not found: production-backups does not exist');
    expect(result.matched).toBe(true);
    expect(result.match?.errorCode).toBe('PPDM-0006');
  });

  it('matches NW-0001 saveset failed', () => {
    const result = classifyLog('saveset failed with completion code 3 for client srv01');
    expect(result.matched).toBe(true);
    expect(result.match?.errorCode).toBe('NW-0001');
    expect(result.match?.product).toBe('NetWorker');
  });

  it('matches NW-0002 media not available', () => {
    const result = classifyLog('no media available in pool; volume not found in jukebox');
    expect(result.matched).toBe(true);
    expect(result.match?.errorCode).toBe('NW-0002');
  });

  it('matches NW-0003 client unreachable', () => {
    const result = classifyLog('nsrexecd failed: client not responding on port 7937');
    expect(result.matched).toBe(true);
    expect(result.match?.errorCode).toBe('NW-0003');
  });

  it('matches NW-0004 index corruption', () => {
    const result = classifyLog('nsrck failed: client index corrupt, rebuild required');
    expect(result.matched).toBe(true);
    expect(result.match?.errorCode).toBe('NW-0004');
    expect(result.match?.severity).toBe('WARNING');
  });

  it('matches DD-0001 Data Domain capacity warning', () => {
    const result = classifyLog('data domain capacity at 87% full — alert triggered');
    expect(result.matched).toBe(true);
    expect(result.match?.errorCode).toBe('DD-0001');
    expect(result.match?.product).toBe('DataDomain');
  });

  it('matches DD-0002 DDBoost disabled', () => {
    const result = classifyLog('ddboost disabled: ddboost connection failed from backup server');
    expect(result.matched).toBe(true);
    expect(result.match?.errorCode).toBe('DD-0002');
  });

  it('returns unmatched for a generic log', () => {
    const result = classifyLog('INFO: Job completed successfully. Duration: 00:12:34');
    expect(result.matched).toBe(false);
    expect(result.match).toBeUndefined();
    expect(result.confidence).toBe('low');
  });

  it('is case-insensitive', () => {
    const result = classifyLog('VPROXY UNREACHABLE: Connection refused from backup agent');
    expect(result.matched).toBe(true);
    expect(result.match?.errorCode).toBe('PPDM-0001');
  });

  it('TAXONOMY has expected entry count', () => {
    expect(TAXONOMY.length).toBe(12);
  });

  it('all taxonomy entries have required fields', () => {
    for (const entry of TAXONOMY) {
      expect(entry.errorCode).toBeTruthy();
      expect(entry.title).toBeTruthy();
      expect(entry.rootCause).toBeTruthy();
      expect(entry.fixCommands.length).toBeGreaterThan(0);
      expect(['CRITICAL', 'WARNING', 'INFO']).toContain(entry.severity);
      expect(['PPDM', 'NetWorker', 'DataDomain', 'Generic']).toContain(entry.product);
    }
  });
});
