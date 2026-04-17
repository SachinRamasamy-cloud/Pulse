/**
 * BUG FIX #1 + #5: Rewritten to avoid heredoc/escaping issues.
 * Token and API URL are hardcoded directly — no sed substitutions needed.
 * Docker compose uses a separate entrypoint script instead of inline shell.
 */

/**
 * Generate the bash install script.
 * Token and apiUrl are interpolated directly — no runtime substitution required.
 */
export function generateInstallScript(agentToken, apiUrl) {
  const reportUrl = `${apiUrl}/api/agent/report`;

  // The agent script is written as a plain string — no heredoc, no escaping issues.
  const agentScript = [
    '#!/bin/bash',
    `# PulseBoard Agent — token: ${agentToken.slice(0, 12)}...`,
    `REPORT_URL="${reportUrl}"`,
    `TOKEN="${agentToken}"`,
    'INTERVAL=30',
    '',
    'while true; do',
    '  CPU=$(top -bn1 2>/dev/null | grep -i "cpu" | head -1 | awk \'{',
    '    for(i=1;i<=NF;i++) if($i~/id/) { gsub(/[^0-9.]/,"",$i); print 100-$i; exit }',
    '  }\' || echo "0")',
    '  RAM_TOTAL=$(awk \'/MemTotal/{print $2*1024}\' /proc/meminfo 2>/dev/null || echo 0)',
    '  RAM_AVAIL=$(awk \'/MemAvailable/{print $2*1024}\' /proc/meminfo 2>/dev/null || echo 0)',
    '  RAM_USED=$((RAM_TOTAL - RAM_AVAIL))',
    '  DISK_TOTAL=$(df -B1 / 2>/dev/null | tail -1 | awk \'{print $2}\' || echo 0)',
    '  DISK_USED=$(df -B1 / 2>/dev/null | tail -1 | awk \'{print $3}\' || echo 0)',
    '  LOAD1=$(awk \'{print $1}\' /proc/loadavg 2>/dev/null || echo 0)',
    '  LOAD5=$(awk \'{print $2}\' /proc/loadavg 2>/dev/null || echo 0)',
    '  LOAD15=$(awk \'{print $3}\' /proc/loadavg 2>/dev/null || echo 0)',
    '  UPTIME=$(awk \'{print int($1)}\' /proc/uptime 2>/dev/null || echo 0)',
    '  PROCS=$(ps -e --no-headers 2>/dev/null | wc -l || echo 0)',
    '  OS=$(grep PRETTY_NAME /etc/os-release 2>/dev/null | cut -d= -f2 | tr -d \'"\' || echo "Linux")',
    '  KERNEL=$(uname -r 2>/dev/null || echo "unknown")',
    '  CPU_MODEL=$(grep "model name" /proc/cpuinfo 2>/dev/null | head -1 | cut -d: -f2 | xargs || echo "Unknown CPU")',
    '  CPU_CORES=$(nproc 2>/dev/null || echo 1)',
    '  ARCH=$(uname -m 2>/dev/null || echo "x86_64")',
    '',
    '  # Escape special chars in string values',
    '  OS_SAFE=$(echo "$OS" | sed \'s/["\\\\/]//g\')',
    '  CPU_SAFE=$(echo "$CPU_MODEL" | sed \'s/["\\\\/]//g\')',
    '',
    '  curl -sf --max-time 8 -X POST "$REPORT_URL" \\',
    '    -H "Authorization: Bearer $TOKEN" \\',
    '    -H "Content-Type: application/json" \\',
    '    -d "{' +
      '"cpuPercent":${CPU},' +
      '"ramUsed":${RAM_USED},"ramTotal":${RAM_TOTAL},' +
      '"diskUsed":${DISK_USED},"diskTotal":${DISK_TOTAL},' +
      '"loadAvg1":${LOAD1},"loadAvg5":${LOAD5},"loadAvg15":${LOAD15},' +
      '"uptimeSeconds":${UPTIME},"processes":${PROCS},' +
      '"specs":{"os":"${OS_SAFE}","kernel":"${KERNEL}","cpuModel":"${CPU_SAFE}","cpuCores":${CPU_CORES},"arch":"${ARCH}"}}' +
    '" || true',
    '  sleep $INTERVAL',
    'done',
  ].join('\n');

  // The installer writes the agent script using printf (avoids all heredoc issues)
  return [
    '#!/bin/bash',
    '# PulseBoard Agent Installer',
    '# Requires: bash, curl, systemd, root (or sudo)',
    'set -e',
    '',
    'echo "🚀 Installing PulseBoard agent..."',
    '',
    `# Write agent script using printf to avoid heredoc quoting issues`,
    `printf '%s\\n' ${shellEscape(agentScript)} > /usr/local/bin/pulseboard-agent`,
    'chmod +x /usr/local/bin/pulseboard-agent',
    '',
    '# Install systemd service',
    'cat > /etc/systemd/system/pulseboard-agent.service << \'SVC\'',
    '[Unit]',
    'Description=PulseBoard Monitoring Agent',
    'After=network-online.target',
    'Wants=network-online.target',
    '',
    '[Service]',
    'Type=simple',
    'ExecStart=/usr/local/bin/pulseboard-agent',
    'Restart=on-failure',
    'RestartSec=15',
    'StandardOutput=journal',
    'StandardError=journal',
    '',
    '[Install]',
    'WantedBy=multi-user.target',
    'SVC',
    '',
    'systemctl daemon-reload',
    'systemctl enable --now pulseboard-agent',
    '',
    'echo "✅ PulseBoard agent installed and running!"',
    'echo "   Metrics will appear in your dashboard within 30 seconds."',
    `echo "   Token prefix: ${agentToken.slice(0, 16)}..."`,
  ].join('\n');
}

/**
 * BUG FIX #5: Docker agent — uses a proper entrypoint script written to a tmp file.
 * No inline shell in docker-compose command key. Clean, valid YAML.
 */
export function generateDockerCompose(agentToken, apiUrl) {
  const reportUrl = `${apiUrl}/api/agent/report`;

  // Entrypoint script is base64-encoded to avoid any YAML quoting issues
  const entrypointScript = [
    '#!/bin/sh',
    `REPORT_URL="${reportUrl}"`,
    `TOKEN="${agentToken}"`,
    'INTERVAL=30',
    'apk add --no-cache curl procps 2>/dev/null || true',
    'while true; do',
    '  CPU=$(top -bn1 2>/dev/null | grep Cpu | awk \'{for(i=1;i<=NF;i++) if($i~/id/){gsub(/[^0-9.]/,"",$i);print 100-$i;exit}}\' || echo 0)',
    '  RAM_T=$(awk \'/MemTotal/{print $2*1024}\' /proc/meminfo 2>/dev/null || echo 0)',
    '  RAM_A=$(awk \'/MemAvailable/{print $2*1024}\' /proc/meminfo 2>/dev/null || echo 0)',
    '  RAM_U=$((RAM_T-RAM_A))',
    '  DISK_T=$(df -B1 / 2>/dev/null | tail -1 | awk \'{print $2}\' || echo 0)',
    '  DISK_U=$(df -B1 / 2>/dev/null | tail -1 | awk \'{print $3}\' || echo 0)',
    '  LOAD=$(awk \'{print $1,$2,$3}\' /proc/loadavg 2>/dev/null || echo "0 0 0")',
    '  L1=$(echo $LOAD | cut -d" " -f1)',
    '  L5=$(echo $LOAD | cut -d" " -f2)',
    '  L15=$(echo $LOAD | cut -d" " -f3)',
    '  UP=$(awk \'{print int($1)}\' /proc/uptime 2>/dev/null || echo 0)',
    '  curl -sf --max-time 8 -X POST "$REPORT_URL" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\',
    '    -d "{\\"cpuPercent\\":${CPU},\\"ramUsed\\":${RAM_U},\\"ramTotal\\":${RAM_T},\\"diskUsed\\":${DISK_U},\\"diskTotal\\":${DISK_T},\\"loadAvg1\\":${L1},\\"loadAvg5\\":${L5},\\"loadAvg15\\":${L15},\\"uptimeSeconds\\":${UP}}" || true',
    '  sleep $INTERVAL',
    'done',
  ].join('\n');

  const b64 = Buffer.from(entrypointScript).toString('base64');

  return [
    'version: "3.8"',
    'services:',
    '  pulseboard-agent:',
    '    image: alpine:3.19',
    '    restart: unless-stopped',
    '    network_mode: host',
    '    pid: host',
    '    privileged: true',
    '    entrypoint:',
    `      - sh`,
    `      - -c`,
    `      - |`,
    `        echo "${b64}" | base64 -d > /run/pb-agent.sh`,
    `        chmod +x /run/pb-agent.sh`,
    `        exec /run/pb-agent.sh`,
    '',
    '# Usage:',
    '#   docker-compose up -d',
    '#   docker-compose logs -f   # to see agent output',
  ].join('\n');
}

// ── Shell-escape a multi-line string for use in printf ────────────────────────
// Wraps in single quotes and escapes embedded single quotes
function shellEscape(str) {
  // Split by lines, escape each, wrap in $'...' syntax (ANSI-C quoting)
  // This is universally supported in bash
  const escaped = str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
  return `$'${escaped}'`;
}
