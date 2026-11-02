import fs from 'node:fs';
import path from 'node:path';

export function readBounded(root, relative, maxBytes = Infinity) {
  if (typeof relative !== 'string' || !relative || relative.split('/').some(part => !part || part === '.' || part === '..') || path.isAbsolute(relative) || relative.includes('\\')) throw new Error(`unsafe path ${relative}`);
  let current = root;
  const parts = relative.split('/');
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink() || (i < parts.length - 1 ? !stat.isDirectory() : !stat.isFile())) throw new Error(`unsafe path ${relative}`);
  }
  const fd = fs.openSync(current, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    if (fs.fstatSync(fd).size > maxBytes) throw new Error(`file too large ${relative}`);
    const bytes = fs.readFileSync(fd);
    if (bytes.length > maxBytes) throw new Error(`file too large ${relative}`);
    return bytes;
  } finally { fs.closeSync(fd); }
}
