import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { unlink, writeFile } from 'fs/promises';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { q } from './db.js';
import { auth, uidOf } from './auth.js';
import { HttpError } from './util.js';

// Imagens ficam em server/uploads e são servidas em /uploads (ver index.ts).
// Em produção, troque por um armazenamento na nuvem (S3, R2, Neon Storage…).
export const UPLOAD_DIR = path.resolve('uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_BYTES = 5 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } });

// Confere o tipo pelos primeiros bytes do arquivo (o mimetype enviado pelo cliente não é confiável)
function detectExt(b: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

export const uploads = Router();

const receive = (req: any, res: any, next: any) => upload.single('image')(req, res, (err) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, 'image_too_large'));
  next(err);
});

async function save(file: Express.Multer.File | undefined, prefix: string) {
  if (!file) throw new HttpError(400, 'image_required');
  const ext = detectExt(file.buffer);
  if (!ext) throw new HttpError(415, 'image_invalid_type');
  const name = `${prefix}-${randomUUID()}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, name), file.buffer);
  return `/uploads/${name}`;
}

// Imagem de post: só sobe o arquivo e devolve a URL; o post é criado depois com { imageUrl }
uploads.post('/uploads/image', auth, receive, async (req, res) => {
  res.status(201).json({ url: await save(req.file, 'post') });
});

const COLUMNS = { avatar: 'avatar_url', cover: 'cover_url' } as const;

for (const [kind, column] of Object.entries(COLUMNS)) {
  uploads.post(`/me/${kind}`, auth, receive, async (req, res) => {
    const url = await save(req.file, kind);

    const [old] = await q<{ url: string | null }>(
      `update users u set ${column}=$2 from (select ${column} as url from users where id=$1) o where u.id=$1 returning o.url`,
      [uidOf(res), url]);
    // Apaga a imagem anterior, se era um arquivo nosso
    if (old?.url?.startsWith('/uploads/')) await unlink(path.join(UPLOAD_DIR, path.basename(old.url))).catch(() => {});

    res.status(201).json({ url });
  });

  uploads.delete(`/me/${kind}`, auth, async (_req, res) => {
    const [old] = await q<{ url: string | null }>(
      `update users u set ${column}=null from (select ${column} as url from users where id=$1) o where u.id=$1 returning o.url`,
      [uidOf(res)]);
    if (old?.url?.startsWith('/uploads/')) await unlink(path.join(UPLOAD_DIR, path.basename(old.url))).catch(() => {});
    res.status(204).end();
  });
}
