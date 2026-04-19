import crypto from 'crypto';

const ENC_PREFIX = 'enc:v1';
const ENC_ALGO = 'aes-256-gcm';

const encryptionSeed =
  process.env.DATA_ENCRYPTION_KEY ||
  process.env.JWT_SECRET ||
  'dev-only-encryption-seed-change-me';

const hashSeed =
  process.env.IP_HASH_PEPPER ||
  process.env.PASSWORD_PEPPER ||
  process.env.JWT_SECRET ||
  'dev-only-hash-seed-change-me';

const encryptionKey = crypto
  .createHash('sha256')
  .update(`enc:${encryptionSeed}`)
  .digest();

const hashKey = crypto
  .createHash('sha256')
  .update(`hash:${hashSeed}`)
  .digest();

export function canonicaliseIp(ip) {
  if (typeof ip !== 'string') return null;
  const clean = ip.trim().toLowerCase();
  return clean || null;
}

export function isEncryptedPayload(value) {
  return typeof value === 'string' && value.startsWith(`${ENC_PREFIX}:`);
}

export function encryptText(plainText) {
  if (!plainText) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENC_ALGO, encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${ENC_PREFIX}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptText(payload) {
  if (!payload) return null;
  if (!isEncryptedPayload(payload)) return payload;

  try {
    const parts = payload.split(':');
    if (parts.length !== 5) return null;

    const [, , ivHex, tagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = crypto.createDecipheriv(ENC_ALGO, encryptionKey, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

export function hashDeterministic(value, namespace = 'default') {
  if (!value) return null;
  return crypto
    .createHmac('sha256', hashKey)
    .update(`${namespace}:${String(value)}`)
    .digest('hex');
}
