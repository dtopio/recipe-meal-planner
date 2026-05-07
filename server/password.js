import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

export async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, SALT_ROUNDS)
}

export async function verifyPassword(plaintext, hash) {
  if (!hash) return false
  // Support legacy plaintext passwords during migration
  if (!hash.startsWith('$2a$') && !hash.startsWith('$2b$')) {
    return plaintext === hash
  }
  return bcrypt.compare(plaintext, hash)
}
