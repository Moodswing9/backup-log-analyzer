"""
PostToolUse hook for backup-log-analyzer.
- Runs tsc --noEmit on any TypeScript file change
- Runs ESLint on route.ts specifically (security-critical PII redaction path)
"""
import json
import os
import subprocess
import sys

d = json.load(sys.stdin)
f = (d.get("tool_input", {}).get("file_path", "") or "").replace("\\", "/")

if not f:
    sys.exit(0)

cwd = os.getcwd()

# TypeScript type check on any .ts/.tsx change
if f.endswith(".ts") or f.endswith(".tsx"):
    print("Running tsc --noEmit...")
    r = subprocess.run(
        ["npx", "tsc", "--noEmit"],
        capture_output=True, text=True, cwd=cwd
    )
    if r.returncode != 0:
        print(f"TypeScript errors:\n{r.stdout}{r.stderr}")
        sys.exit(1)
    print("TypeScript OK")

# ESLint on the API route — PII redaction lives here, keep it clean
if "route.ts" in f:
    print("Running ESLint on route.ts...")
    r = subprocess.run(
        ["npx", "eslint", "src/app/api/analyze/route.ts", "--max-warnings", "0"],
        capture_output=True, text=True, cwd=cwd
    )
    if r.stdout.strip() or r.stderr.strip():
        print(r.stdout.strip() or r.stderr.strip())
