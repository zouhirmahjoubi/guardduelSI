export function downloadFile(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadJSON(filename: string, data: unknown) {
  downloadFile(filename, JSON.stringify(data, null, 2), 'application/json');
}

export function downloadMD(filename: string, content: string) {
  downloadFile(filename, content, 'text/markdown');
}

// Simple SHA-256 hash using SubtleCrypto
export async function sha256(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback simple hash
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) - h + text.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).padStart(8, '0');
}

// Obfuscation utilities
export function toBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}
export function fromBase64(str: string): string {
  return decodeURIComponent(escape(atob(str)));
}
export function toROT13(str: string): string {
  return str.replace(/[a-zA-Z]/g, (c) => {
    const code = c.charCodeAt(0);
    const base = code >= 65 && code <= 90 ? 65 : 97;
    return String.fromCharCode(((code - base + 13) % 26) + base);
  });
}
export function toLeetspeak(str: string): string {
  const map: Record<string, string> = {
    a: '4', e: '3', i: '1', o: '0', s: '5', t: '7', l: '1', g: '9',
    A: '4', E: '3', I: '1', O: '0', S: '5', T: '7', L: '1', G: '9',
  };
  return str.replace(/[aeiosstlgAEIOSSTLG]/g, (c) => map[c] || c);
}
export function toHex(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) return navigator.clipboard.writeText(text);
  return Promise.resolve();
}
