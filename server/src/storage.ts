import { mkdirSync } from 'fs';
import { unlink, writeFile } from 'fs/promises';
import path from 'path';

/**
 * Onde as imagens ficam guardadas.
 * - Com SUPABASE_URL e SUPABASE_SERVICE_KEY: no Supabase Storage (bucket público, padrão "stans").
 *   Use em produção: servidores grátis (como o Render) apagam o disco a cada reinício.
 * - Sem elas: em server/uploads, servidas pela própria API em /uploads (bom para rodar no computador).
 */
export const UPLOAD_DIR = path.resolve('uploads');

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET ?? 'stans';
const cloud = !!(SUPABASE_URL && SUPABASE_KEY);

/** Começo das URLs públicas das nossas imagens na nuvem (null se estiver guardando no disco). */
export const PUBLIC_PREFIX = cloud ? `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/` : null;

if (!cloud) mkdirSync(UPLOAD_DIR, { recursive: true });

// Chaves novas (sb_secret_...) vão só no "apikey"; as antigas (JWT service_role) também no Authorization
const headers = (): Record<string, string> => ({
  apikey: SUPABASE_KEY!,
  ...(!SUPABASE_KEY!.startsWith('sb_') && { Authorization: `Bearer ${SUPABASE_KEY}` }),
});

/** Guarda o arquivo e devolve a URL que vai para o banco. */
export async function putImage(name: string, data: Buffer, contentType: string) {
  if (!cloud) {
    await writeFile(path.join(UPLOAD_DIR, name), data);
    return `/uploads/${name}`;
  }
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${name}`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': contentType, 'Cache-Control': 'max-age=604800' },
    body: new Uint8Array(data),
  });
  if (!res.ok) throw new Error(`Supabase Storage respondeu ${res.status}`);
  return PUBLIC_PREFIX + name;
}

/** Apaga uma imagem nossa (disco ou nuvem). URLs de fora são ignoradas. */
export async function removeImage(url: string | null | undefined) {
  if (!url) return;
  if (url.startsWith('/uploads/')) {
    await unlink(path.join(UPLOAD_DIR, path.basename(url))).catch(() => {});
  } else if (PUBLIC_PREFIX && url.startsWith(PUBLIC_PREFIX)) {
    const name = path.basename(url);
    await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${name}`, { method: 'DELETE', headers: headers() }).catch(() => {});
  }
}

/** A imagem de um post precisa ter sido enviada por nós (POST /uploads/image). */
export const isOurImage = (url: string) =>
  /^\/uploads\/[\w.-]+$/.test(url) || (!!PUBLIC_PREFIX && url.startsWith(PUBLIC_PREFIX) && /^[\w.-]+$/.test(url.slice(PUBLIC_PREFIX.length)));
