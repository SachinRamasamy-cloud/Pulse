import mongoose from 'mongoose';
import crypto from 'crypto';

const serverSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name:   { type: String, required: true, trim: true, maxlength: 80 },
    tags:   [{ type: String, trim: true, maxlength: 40 }],
    notes:  { type: String, maxlength: 500, default: '' },

    // ── Connection method ──────────────────────────────────────────────────────
    connectionType: {
      type: String,
      enum: ['api', 'agent', 'docker', 'custom'],
      required: true,
      default: 'custom',
    },

    // ── Custom / agent IP ──────────────────────────────────────────────────────
    ip: { type: String, trim: true, default: null },

    // ── Provider API (Pro Plus) ───────────────────────────────────────────────
    provider: {
      type: String,
      enum: ['hetzner', 'digitalocean', 'vultr', 'linode', null],
      default: null,
    },
    // BUG FIX #4: providerApiKey + agentToken MUST be select:false
    // so they NEVER appear in list/get responses — only in dedicated routes
    providerApiKey:   { type: String, default: null, select: false },
    providerServerId: { type: String, default: null },

    // ── Agent tokens (Pro+) ───────────────────────────────────────────────────
    agentToken:    { type: String, default: null, index: true, select: false },  // BUG FIX #4
    agentTokenHash:{ type: String, default: null, select: false }, // SHA-256 of token for fast lookup
    lastAgentPing: { type: Date,   default: null },

    // ── Live status ───────────────────────────────────────────────────────────
    isOnline:      { type: Boolean, default: null },
    agentInstalled:{ type: Boolean, default: false }, // true once first report received
    pingMs:        { type: Number,  default: null },
    openPort:      { type: Number,  default: null },
    lastChecked:   { type: Date,    default: null },

    // ── Geo cache ─────────────────────────────────────────────────────────────
    geoCache: {
      country: String, countryCode: String, regionName: String,
      city: String, isp: String, org: String,
      as: String, asname: String,
      lat: Number, lon: Number, timezone: String,
      reverse: String, hosting: Boolean, proxy: Boolean, mobile: Boolean,
    },

    // ── Server specs (from provider API or agent) ─────────────────────────────
    specs: {
      os: String, kernel: String, arch: String,
      cpuModel: String, cpuCores: Number, cpuThreads: Number,
      ramTotal: Number, diskTotal: Number, serverType: String,
    },

    // ── Live metrics (agent / provider API) ───────────────────────────────────
    metrics: {
      cpuPercent:    { type: Number, default: null },
      ramUsed:       { type: Number, default: null },
      ramTotal:      { type: Number, default: null },
      diskUsed:      { type: Number, default: null },
      diskTotal:     { type: Number, default: null },
      netIn:         { type: Number, default: null },
      netOut:        { type: Number, default: null },
      loadAvg1:      { type: Number, default: null },
      loadAvg5:      { type: Number, default: null },
      loadAvg15:     { type: Number, default: null },
      uptimeSeconds: { type: Number, default: null },
      processes:     { type: Number, default: null },
      updatedAt:     { type: Date,   default: null },
    },
  },
  { timestamps: true }
);

// ── Unique IP per user ─────────────────────────────────────────────────────────
serverSchema.index({ userId: 1, ip: 1 }, { unique: true, sparse: true });
// Fast agent token lookup by hash
serverSchema.index({ agentTokenHash: 1 }, { sparse: true });

// ── Generate secure agent token ───────────────────────────────────────────────
serverSchema.statics.generateAgentToken = () =>
  'pbagt_' + crypto.randomBytes(40).toString('hex');

// ── Hash agent token for DB lookup ────────────────────────────────────────────
serverSchema.statics.hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

export default mongoose.model('Server', serverSchema);
