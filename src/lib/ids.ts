export function newId(): string {
  return crypto.randomUUID();
}

/** Unpredictable, URL-safe token (256 bits by default) from the platform CSPRNG. */
export function secureToken(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function nowIso(): string {
  return new Date().toISOString();
}
