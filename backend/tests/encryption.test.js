// Set key BEFORE requiring the module (module validates at load time)
process.env.ENCRYPTION_KEY = 'a'.repeat(64); // valid 64-hex-char test key

const { encrypt, decrypt, encryptStudent, decryptStudent } = require('../src/lib/encryption');

describe('encrypt / decrypt', () => {
  it('produces a string in iv:authTag:ciphertext format', () => {
    const result = encrypt('hello');
    const parts = result.split(':');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toHaveLength(24);  // 12 bytes = 24 hex chars
    expect(parts[1]).toHaveLength(32);  // 16 bytes = 32 hex chars
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it('round-trips a plain string', () => {
    expect(decrypt(encrypt('Test Student'))).toBe('Test Student');
  });

  it('round-trips a string with special characters and unicode', () => {
    const val = 'Ágnes O\'Brien, 李伟 "nickname"';
    expect(decrypt(encrypt(val))).toBe(val);
  });

  it('returns null for null input (encrypt)', () => {
    expect(encrypt(null)).toBeNull();
  });

  it('returns null for undefined input (encrypt)', () => {
    expect(encrypt(undefined)).toBeNull();
  });

  it('returns null for null input (decrypt)', () => {
    expect(decrypt(null)).toBeNull();
  });

  it('produces different ciphertext each call (fresh IV)', () => {
    const a = encrypt('same value');
    const b = encrypt('same value');
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe('same value');
    expect(decrypt(b)).toBe('same value');
  });

  it('throws on tampered ciphertext (auth tag mismatch)', () => {
    const ciphertext = encrypt('sensitive');
    const [iv, authTag, data] = ciphertext.split(':');
    // Replace data bytes with ff... keeping format valid so the regex passes
    const tampered = `${iv}:${authTag}:${'ff'.repeat(data.length / 2)}`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it('returns plaintext as-is for unencrypted legacy values', () => {
    expect(decrypt('Alice')).toBe('Alice');
    expect(decrypt('555-1234')).toBe('555-1234');
  });
});

describe('encryptStudent / decryptStudent', () => {
  it('encrypts only PII fields, leaves others unchanged', () => {
    const student = {
      id: 'abc-123',
      name: 'Alice',
      date_of_birth: '2015-06-01',
      skill_level: 'Beginner',
      parent_name: 'Bob',
      parent_phone: '555-0001',
      parent_email: 'bob@test.com',
      status: 'active',
    };
    const encrypted = encryptStudent(student);
    expect(encrypted.name).not.toBe('Alice');
    expect(encrypted.parent_name).not.toBe('Bob');
    expect(encrypted.parent_phone).not.toBe('555-0001');
    expect(encrypted.parent_email).not.toBe('bob@test.com');
    // date_of_birth is NOT encrypted (stored in a DATE column)
    expect(encrypted.date_of_birth).toBe('2015-06-01');
    expect(encrypted.id).toBe('abc-123');
    expect(encrypted.skill_level).toBe('Beginner');
    expect(encrypted.status).toBe('active');
  });

  it('round-trips a full student object', () => {
    const student = {
      id: 'abc-123',
      name: 'Alice',
      date_of_birth: '2015-06-01',
      skill_level: 'Beginner',
      parent_name: 'Bob',
      parent_phone: '555-0001',
      parent_email: 'bob@test.com',
      status: 'active',
    };
    expect(decryptStudent(encryptStudent(student))).toEqual(student);
  });

  it('handles null parent fields (adult students)', () => {
    const adult = {
      id: 'xyz',
      name: 'Carol',
      date_of_birth: '1990-01-01',
      skill_level: 'Advanced',
      parent_name: null,
      parent_phone: null,
      parent_email: null,
      status: 'active',
    };
    const encrypted = encryptStudent(adult);
    expect(encrypted.parent_name).toBeNull();
    expect(encrypted.parent_phone).toBeNull();
    expect(encrypted.parent_email).toBeNull();
    expect(decryptStudent(encrypted)).toEqual(adult);
  });

  it('handles a partial object (only some PII fields present)', () => {
    const partial = { id: 'abc', name: 'Dave' };
    const enc = encryptStudent(partial);
    expect(enc.name).not.toBe('Dave');
    expect(enc.id).toBe('abc');
    expect(decryptStudent(enc)).toEqual(partial);
  });
});

describe('startup validation', () => {
  it('throws if ENCRYPTION_KEY is missing', () => {
    const saved = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    jest.resetModules();
    expect(() => require('../src/lib/encryption')).toThrow(/ENCRYPTION_KEY/);
    process.env.ENCRYPTION_KEY = saved;
    jest.resetModules();
  });

  it('throws if ENCRYPTION_KEY is not 64 hex characters', () => {
    const saved = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = 'tooshort';
    jest.resetModules();
    expect(() => require('../src/lib/encryption')).toThrow(/ENCRYPTION_KEY/);
    process.env.ENCRYPTION_KEY = saved;
    jest.resetModules();
  });
});
