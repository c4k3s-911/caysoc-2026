// Read host processes through a read-only /proc bind mount. No process is
// killed or signalled here — detection is strictly observational.
import fs from 'fs';
import path from 'path';

const ROOT = process.env.OPS_PROC_ROOT || '/host/proc';
const HZ = Number(process.env.OPS_CLK_TCK || 100);
const ORPHAN_AFTER = Number(process.env.OPS_ORPHAN_AFTER_SEC || 600);

export function listOpencodeProcesses() {
  let dirs;
  try { dirs = fs.readdirSync(ROOT); } catch { return { available: false, processes: [], orphans: [] }; }
  let uptime = 0;
  try { uptime = Number(fs.readFileSync(path.join(ROOT, 'uptime'), 'utf8').split(' ')[0]) || 0; } catch {}
  const processes = [];
  for (const d of dirs) {
    if (!/^\d+$/.test(d)) continue;
    try {
      const cmd = fs.readFileSync(path.join(ROOT, d, 'cmdline'), 'utf8').replace(/\0/g, ' ').trim();
      if (!cmd.includes('opencode run')) continue;
      const stat = fs.readFileSync(path.join(ROOT, d, 'stat'), 'utf8');
      const fields = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/);
      const startTicks = Number(fields[19]) || 0;
      const ageSec = Math.max(0, Math.round(uptime - startTicks / HZ));
      const model = (cmd.match(/--model\s+(\S+)/) || [])[1] || null;
      processes.push({
        pid: Number(d),
        ageSec,
        model,
        command: cmd.slice(0, 220),
        suspected_orphan: ageSec >= ORPHAN_AFTER,
      });
    } catch { /* process exited during scan */ }
  }
  return {
    available: true,
    thresholdSec: ORPHAN_AFTER,
    processes,
    orphans: processes.filter(p => p.suspected_orphan),
  };
}
