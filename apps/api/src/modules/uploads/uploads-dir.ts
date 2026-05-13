import { Logger } from '@nestjs/common';
import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Resuelve el directorio de uploads una vez al boot.
// 1) UPLOADS_DIR env (Railway Volume mount, ej. /data/uploads)
// 2) OS temp dir — siempre escribible en cualquier container
//
// existsSync no basta porque Railway monta volumes como root:root (755) y el
// proceso Node (non-root) no puede escribir. Verificamos write access real.
export function isWritable(dir: string): boolean {
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    accessSync(dir, constants.W_OK);
    const probe = join(dir, `.write_probe_${process.pid}`);
    writeFileSync(probe, '');
    unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

export const RESOLVED_UPLOADS_DIR = (() => {
  const candidates = [
    process.env.UPLOADS_DIR,
    join(tmpdir(), 'kardex-uploads'),
    tmpdir(),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    if (isWritable(dir)) return dir;
  }
  return tmpdir();
})();

new Logger('UploadsDir').log(`Upload directory: ${RESOLVED_UPLOADS_DIR}`);
