const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateSlug(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes)
    .map((byte) => alphabet[byte % alphabet.length])
    .join("");
}
