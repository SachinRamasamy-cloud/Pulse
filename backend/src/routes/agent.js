import express from 'express';
import Server from '../models/Server.js';
import ServerSnapshot from '../models/ServerSnapshot.js';
import { canonicaliseIp } from '../utils/fieldCrypto.js';

const router = express.Router();

/**
 * POST /api/agent/report
 * Called by bash/docker agent every 30s.
 * Auth: Bearer <agentToken>  (NOT a user JWT)
 *
 * BUG FIX #4: We look up by SHA-256 hash of the token (stored as agentTokenHash),
 * so the raw token is never queried from the database directly.
 */
router.post('/report', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token || !token.startsWith('pbagt_')) {
    return res.status(401).json({ error: 'Missing or invalid agent token.' });
  }

  // Lookup by hash — raw token never stored in queryable index
  const tokenHash = Server.hashToken(token);
  const server    = await Server.findOne({ agentTokenHash: tokenHash });

  if (!server) return res.status(401).json({ error: 'Agent token not recognised.' });

  const {
    cpuPercent, ramUsed, ramTotal,
    diskUsed, diskTotal, netIn, netOut,
    loadAvg1, loadAvg5, loadAvg15,
    uptimeSeconds, processes, specs,
  } = req.body;

  // Validate numeric fields to prevent injection
  const safeNum = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  const getRequestIp = () => {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) {
      return xff.split(',')[0]?.trim() || null;
    }
    return req.ip || null;
  };

  server.metrics = {
    cpuPercent:    safeNum(cpuPercent),
    ramUsed:       safeNum(ramUsed),
    ramTotal:      safeNum(ramTotal),
    diskUsed:      safeNum(diskUsed),
    diskTotal:     safeNum(diskTotal),
    netIn:         safeNum(netIn),
    netOut:        safeNum(netOut),
    loadAvg1:      safeNum(loadAvg1),
    loadAvg5:      safeNum(loadAvg5),
    loadAvg15:     safeNum(loadAvg15),
    uptimeSeconds: safeNum(uptimeSeconds),
    processes:     safeNum(processes),
    updatedAt:     new Date(),
  };

  // Safe string specs
  if (specs && typeof specs === 'object') {
    const safeStr = (v, max = 120) => (typeof v === 'string' ? v.slice(0, max) : undefined);
    server.specs = {
      ...server.specs,
      os:       safeStr(specs.os),
      kernel:   safeStr(specs.kernel),
      cpuModel: safeStr(specs.cpuModel),
      cpuCores: safeNum(specs.cpuCores),
      arch:     safeStr(specs.arch, 20),
    };
  }

  // If agent server was created without an IP, capture it from the first report.
  if (!server.getIp()) {
    const reportedIp = canonicaliseIp(getRequestIp());
    if (reportedIp) {
      server.ip = reportedIp;
    }
  }

  server.isOnline       = true;
  server.agentInstalled = true;
  server.lastAgentPing  = new Date();
  server.lastChecked    = new Date();

  await server.save();

  // Snapshot for uptime history
  await ServerSnapshot.create({
    serverId:   server._id,
    isOnline:   true,
    cpuPercent: safeNum(cpuPercent),
    ramPercent: (safeNum(ramUsed) && safeNum(ramTotal))
      ? Math.round((ramUsed / ramTotal) * 100) : null,
    checkedAt:  new Date(),
  });

  res.json({ ok: true, nextIn: 30 });
});

export default router;
