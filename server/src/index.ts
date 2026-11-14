import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { routes } from './routes.js';
import { attachSocket } from './socket.js';
import { uploads } from './uploads.js';
import { PUBLIC_PREFIX, UPLOAD_DIR } from './storage.js';
import { social } from './social.js';
import { safety } from './safety.js';
import { errorHandler } from './util.js';

const app = express();
// Atrás do proxy do Render/Koyeb: o IP real vem no X-Forwarded-For (senão o limite de tentativas vale para todos juntos)
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
// CORS_ORIGIN: endereços do app separados por vírgula (ex.: https://stans.netlify.app). Sem ela, aceita qualquer origem.
const origin = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({ origin: origin?.length ? origin : '*' }));
app.use(express.json({ limit: '100kb' }));

const http = createServer(app);
const io = new Server(http, { cors: { origin: origin?.length ? origin : '*' } });
app.set('io', io);

app.get('/health', (_req, res) => { res.json({ ok: true }); }); // o Render usa para saber se a API subiu
if (!PUBLIC_PREFIX) app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', index: false }));
app.use(uploads);
app.use(safety);
app.use(social);
app.use(routes);
app.use(errorHandler);
attachSocket(io);

const port = Number(process.env.PORT ?? 4000);
http.listen(port, () => console.log(`Stans API em http://localhost:${port}`));
