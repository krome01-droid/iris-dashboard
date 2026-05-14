import { scrypt, randomBytes, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>

const KEY_LEN = 64
const SALT_LEN = 16

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN)
  const derived = await scryptAsync(password, salt, KEY_LEN)
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  if (!stored?.startsWith("scrypt$")) return false
  const [, saltHex, hashHex] = stored.split("$")
  if (!saltHex || !hashHex) return false
  try {
    const salt = Buffer.from(saltHex, "hex")
    const expected = Buffer.from(hashHex, "hex")
    const derived = await scryptAsync(password, salt, expected.length)
    return derived.length === expected.length && timingSafeEqual(derived, expected)
  } catch {
    return false
  }
}
