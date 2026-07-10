export interface TaxonomyMatch {
  product: "PPDM" | "NetWorker" | "DataDomain" | "Generic";
  errorCode: string;
  pattern: RegExp;
  severity: "CRITICAL" | "WARNING" | "INFO";
  title: string;
  rootCause: string;
  fixCommands: string[];
  docsRef?: string;
}

export const TAXONOMY: TaxonomyMatch[] = [
  // ── PPDM ────────────────────────────────────────────────────────────────────
  {
    product: "PPDM", errorCode: "PPDM-0001",
    pattern: /vProxy.*unreachable|vproxy.*connection.*refused|failed to connect.*vproxy/i,
    severity: "CRITICAL",
    title: "vProxy unreachable",
    rootCause: "The vProxy host cannot be reached from PPDM. Possible causes: vProxy service stopped, firewall rule change, or host IP changed.",
    fixCommands: [
      "backupctl doctor  # check vProxy status",
      "curl -k https://<vproxy-host>:7789/api/version  # test connectivity",
      "# Re-register vProxy: PPDM UI → Infrastructure → vProxy → Re-register",
    ],
  },
  {
    product: "PPDM", errorCode: "PPDM-0002",
    pattern: /lockbox.*access denied|credential.*lockbox|lockbox.*failed/i,
    severity: "CRITICAL",
    title: "Lockbox access denied",
    rootCause: "PPDM cannot access the credential lockbox. Usually caused by a password rotation that was not propagated to PPDM.",
    fixCommands: [
      "# Update credentials: PPDM UI → Credentials → Edit → re-enter password",
      "curl -k -X GET https://<ppdm>:8443/api/v2/credentials  # list credentials",
    ],
  },
  {
    product: "PPDM", errorCode: "PPDM-0003",
    pattern: /storage unit.*full|no space left|filesystem.*full|capacity.*exceeded/i,
    severity: "CRITICAL",
    title: "Storage unit full",
    rootCause: "The backup target storage unit has no free space. Backups will fail until space is reclaimed.",
    fixCommands: [
      "backupctl dd status  # check Data Domain capacity",
      "# Expire old copies: PPDM UI → Protection → Copies → Expire",
      "# Run Data Domain cleaning: maintenance cleaning start",
    ],
  },
  {
    product: "PPDM", errorCode: "PPDM-0004",
    pattern: /backup window.*expired|schedule.*missed|protection window/i,
    severity: "WARNING",
    title: "Backup window expired",
    rootCause: "The job did not complete within the configured backup window. Usually caused by a policy schedule that is too tight for the data volume.",
    fixCommands: [
      "curl -k https://<ppdm>:8443/api/v2/protection-policies  # review schedules",
      "# Extend window: PPDM UI → Protection → Policies → Schedule → adjust end time",
    ],
  },
  {
    product: "PPDM", errorCode: "PPDM-0005",
    pattern: /token.*expired|authentication.*failed|401.*unauthorized|invalid.*token/i,
    severity: "WARNING",
    title: "Authentication / token failure",
    rootCause: "PPDM session token expired or credentials are incorrect. Verify PPDM_PASS is current.",
    fixCommands: [
      "# Re-authenticate: check PPDM_PASS in .env matches current PPDM admin password",
      "python -c \"from ppdm.client import PPDMClient; import os; PPDMClient.from_env().login()\"",
    ],
  },
  {
    product: "PPDM", errorCode: "PPDM-0006",
    pattern: /kubernetes.*namespace.*not found|k8s.*namespace.*missing|namespace.*does not exist/i,
    severity: "CRITICAL",
    title: "Kubernetes namespace not found",
    rootCause: "The target Kubernetes namespace no longer exists or the asset definition is stale.",
    fixCommands: [
      "kubectl get namespaces  # verify namespace exists",
      "# Re-discover: PPDM UI → Infrastructure → Kubernetes → Discover",
    ],
  },
  // ── NetWorker ────────────────────────────────────────────────────────────────
  {
    product: "NetWorker", errorCode: "NW-0001",
    pattern: /saveset.*failed|backup.*failed.*completion code [^0]/i,
    severity: "CRITICAL",
    title: "Saveset failed",
    rootCause: "NetWorker backup saveset completed with a non-zero completion code. Check client logs for the specific error.",
    fixCommands: [
      "mminfo -s <NW_HOST> -q \"savetime>last 24 hours\" -r \"name,client,completioncode,totalsize\"",
      "# Check client logs: /nsr/logs/daemon.log on the client host",
    ],
  },
  {
    product: "NetWorker", errorCode: "NW-0002",
    pattern: /media.*not available|no media|volume.*not found|jukebox.*error/i,
    severity: "CRITICAL",
    title: "Media / volume not available",
    rootCause: "NetWorker cannot find a writable volume. The media pool may be exhausted or the jukebox is offline.",
    fixCommands: [
      "nsradmin -s <NW_HOST> -e 'print type: NSR volume; mode: appendable'",
      "# Label new volumes or check jukebox: NetWorker Management Console → Media",
    ],
  },
  {
    product: "NetWorker", errorCode: "NW-0003",
    pattern: /client.*not responding|client.*unreachable|nsrexecd.*failed/i,
    severity: "CRITICAL",
    title: "NetWorker client unreachable",
    rootCause: "The nsrexecd daemon on the client is not responding. Client may be offline or firewall is blocking port 7937.",
    fixCommands: [
      "ping <client-hostname>  # verify host is reachable",
      "# Restart client daemon: systemctl restart nsr  (Linux) or services.msc → NetWorker Client (Windows)",
    ],
  },
  {
    product: "NetWorker", errorCode: "NW-0004",
    pattern: /index.*corrupt|client.*index.*error|nsrck.*failed/i,
    severity: "WARNING",
    title: "Client index corruption",
    rootCause: "The NetWorker client file index is corrupted. Run nsrck to repair.",
    fixCommands: [
      "nsrck -L7 <client-hostname>  # rebuild client index",
      "# Monitor progress: tail -f /nsr/logs/daemon.log",
    ],
  },
  // ── Data Domain ─────────────────────────────────────────────────────────────
  {
    product: "DataDomain", errorCode: "DD-0001",
    pattern: /data domain.*capacity|dd.*\d{2,3}%.*full|filesystem.*\d{2,3}%/i,
    severity: "WARNING",
    title: "Data Domain capacity warning",
    rootCause: "Data Domain filesystem utilisation is high. Performance degrades above 80% and backups fail above 95%.",
    fixCommands: [
      "# Run cleaning: maintenance cleaning start",
      "# Expire old PPDM copies: backupctl dd status",
      "# Check usage: filesys show space",
    ],
  },
  {
    product: "DataDomain", errorCode: "DD-0002",
    pattern: /ddboost.*disabled|ddboost.*not enabled|ddboost.*connection.*failed/i,
    severity: "CRITICAL",
    title: "DDBoost disabled or unreachable",
    rootCause: "DDBoost is disabled on Data Domain or the PPDM/NetWorker server cannot connect to it.",
    fixCommands: [
      "ddboost status  # check DDBoost state on DD",
      "ddboost enable  # re-enable if disabled",
      "# Verify network: ping <DD_HOST> from PPDM/NW server",
    ],
  },
];

export interface ClassifyResult {
  matched: boolean;
  match?: TaxonomyMatch;
  confidence: "high" | "low";
}

export function classifyLog(logText: string): ClassifyResult {
  for (const entry of TAXONOMY) {
    if (entry.pattern.test(logText)) {
      return { matched: true, match: entry, confidence: "high" };
    }
  }
  return { matched: false, confidence: "low" };
}
