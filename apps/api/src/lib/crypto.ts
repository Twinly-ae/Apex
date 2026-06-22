// AES-256-GCM encryption for sensitive data at rest (bank statements).
// Key from ENCRYPTION_KEY (hex/base64/passphrase → 32 bytes).
import crypto from "node:crypto";
import { env } from "../env";

export function encryptionConfigured(): boolean {
  return Boolean(env.ENCRYPTION_KEY);
}

function key(): Buffer {
  const raw = env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY is not set");
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  const b64 = Buffer.from(raw, "base64");
  if (b64.length === 32) return b64;
  // Fallback: derive 32 bytes from an arbitrary passphrase.
  return crypto.createHash("sha256").update(raw).digest();
}

/** Returns "ivB64:tagB64:cipherB64". */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decrypt(blob: string): string {
  const [ivB, tagB, encB] = blob.split(":");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(ivB, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encB, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
