import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { routes } from './routes.js';
import { attachSocket } from './socket.js';
import { UPLOAD_DIR, uploads } from './uploads.js';
import { errorHandler } from './util.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '100kb' }));

const http = createServer(app);
const io = new Server(http, { cors: { origin: '*' } }); // restrinja a origem em produção
app.set('io', io);

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', index: false }));
app.use(uploads);
app.use(routes);
app.use(errorHandler);
attachSocket(io);

const port = Number(process.env.PORT ?? 3000);
http.listen(port, () => console.log(`Stans API em http://localhost:${port}`));
