// Copyright 2026 TheQuantAI
// STUDIO-018: content-level text validation for uploads. Extension checks alone
// let a renamed binary (PNG-as-.csv) into the workspace as mojibake.

/** True if the buffer looks binary: contains NUL bytes or is not valid UTF-8. */
export function isProbablyBinary(buf: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) return true;
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buf);
    return false;
  } catch {
    return true;
  }
}

/** Decode an uploaded file's bytes as text; throws for binary content. */
export function decodeTextFile(buf: ArrayBuffer): string {
  if (isProbablyBinary(buf)) {
    throw new Error("Not a text file (binary content)");
  }
  return new TextDecoder("utf-8").decode(buf);
}
