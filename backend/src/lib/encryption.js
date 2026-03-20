const { createCipheriv, createDecipheriv, randomBytes } = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

// Validate key at module load time — fail fast if misconfigured
const rawKey = process.env.ENCRYPTION_KEY;
if (!rawKey || !/^[0-9a-fA-F]{64}$/.test(rawKey)) {
  throw new Error('ENCRYPTION_KEY must be set to a 64-character hex string');
}
const KEY = Buffer.from(rawKey, 'hex');

function encrypt(plaintext) {
  if (plaintext == null) return null;
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, KEY, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

const ENCRYPTED_RE = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/;

function decrypt(ciphertext) {
  if (ciphertext == null) return null;
  // Return plaintext values as-is (handles unencrypted legacy records)
  if (!ENCRYPTED_RE.test(ciphertext)) return ciphertext;
  const [ivHex, authTagHex, dataHex] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, KEY, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

const PII_FIELDS = ['name', 'parent_name', 'parent_phone', 'parent_email'];

function encryptStudent(student) {
  const result = { ...student };
  for (const field of PII_FIELDS) {
    if (field in result) result[field] = encrypt(result[field]);
  }
  return result;
}

function decryptStudent(student) {
  const result = { ...student };
  for (const field of PII_FIELDS) {
    if (field in result) result[field] = decrypt(result[field]);
  }
  return result;
}

module.exports = { encrypt, decrypt, encryptStudent, decryptStudent };
