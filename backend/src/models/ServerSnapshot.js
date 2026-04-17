import mongoose from 'mongoose';

const snapshotSchema = new mongoose.Schema({
  serverId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true, index: true },
  isOnline:  { type: Boolean, required: true },
  pingMs:    { type: Number, default: null },
  // Live metrics snapshot (from agent/API if available)
  cpuPercent:{ type: Number, default: null },
  ramPercent:{ type: Number, default: null },
  checkedAt: { type: Date, default: Date.now },
});

// Expire after 30 days (free/pro) — Pro Plus keeps 90 days (handled in query)
snapshotSchema.index({ checkedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export default mongoose.model('ServerSnapshot', snapshotSchema);
