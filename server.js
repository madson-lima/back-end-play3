require('dotenv').config();

const express         = require('express');
const helmet          = require('helmet');
const cors             = require('cors');
const rateLimit        = require('express-rate-limit');
const mongoose         = require('mongoose');
const { GridFSBucket } = require('mongodb');
const multer           = require('multer');
const path              = require('path');
const https              = require('https');
const http                 = require('http');
const { URL }               = require('url');

// Rotas e middlewares próprios
const connectDB       = require('./config/db');
const authRoutes       = require('./routes/authRoutes');
const productRoutes    = require('./routes/productRoutes');
const postRoutes         = require('./routes/postRoutes');
const contactRoutes      = require('./routes/contactRoutes');
const carouselRoutes     = require('./routes/carouselRoutes');
const verifyToken         = require('./middlewares/verifyToken');

const app  = express();
const PORT = process.env.PORT || 5000;
app.set('trust proxy', 1);

/* =========================================================
   1) Redirecionar HTTP → HTTPS (produção)
========================================================= */
app.use((req, res, next) => {
  const proto = req.get('x-forwarded-proto');
  if (process.env.NODE_ENV === 'production' && proto && proto !== 'https') {
    return res.redirect(301, `https://${req.get('host')}${req.originalUrl}`);
  }
  next();
});

/* =========================================================
   2) Conectar ao MongoDB + inicializar GridFSBucket
========================================================= */
connectDB();
let gfsBucket;
mongoose.connection.once('open', () => {
  gfsBucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
  console.log('✅ GridFSBucket inicializado');
});

/* =========================================================
   3) Middlewares globais
========================================================= */
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.options('*', cors());

app.use(express.json());

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.disable('x-powered-by');

/* =========================================================
   4) Rate limiters
========================================================= */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de autenticação. Aguarde alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Muitas requisições em pouco tempo. Tente novamente em instantes.' },
  standardHeaders: true,
  legacyHeaders: false
});

/* =========================================================
   5) Arquivos estáticos
========================================================= */
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h',
  setHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));
app.use('/pages', express.static(path.join(__dirname, 'pages')));
app.use('/imagens', express.static(path.join(__dirname, 'imagens')));

/* =========================================================
   6) Rotas simples
========================================================= */
app.get('/', (req, res) => res.send('🚀 API e MongoDB OK!'));
app.get('/admin/dashboard', verifyToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'admin-dashboard.html'));
});

/* =========================================================
   7) Proxy de imagens externas → same-origin
========================================================= */
app.get('/api/image-proxy', (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).send('Missing url');

  let u;
  try { u = new URL(target); } catch { return res.status(400).send('Invalid url'); }
  if (!/^https?:$/.test(u.protocol)) return res.status(400).send('Unsupported protocol');

  const client = u.protocol === 'https:' ? https : http;
  const request = client.get(u, (r) => {
    const ct = r.headers['content-type'] || '';
    if (!ct.startsWith('image/')) { res.status(415).send('Unsupported media type'); r.resume(); return; }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Type', ct);

    r.pipe(res);
  });

  request.on('error', (err) => {
    console.error('Proxy error:', err);
    res.status(502).send('Bad gateway');
  });

  request.setTimeout(12000, () => request.destroy(new Error('Upstream timeout')));
});

/* =========================================================
   8) Upload com Multer para GridFS
========================================================= */
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Somente imagens são permitidas!'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.post('/api/upload', apiLimiter, upload.single('image'), (req, res) => {
  if (!gfsBucket) return res.status(503).json({ error: 'Banco de arquivos não pronto' });
  if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada!' });

  const filename = `upload_${Date.now()}${path.extname(req.file.originalname || '')}`;
  const uploadStream = gfsBucket.openUploadStream(filename, {
    contentType: req.file.mimetype,
    metadata: { contentType: req.file.mimetype }
  });

  uploadStream.end(req.file.buffer);

  uploadStream.on('error', err => {
    console.error('❌ Erro no upload GridFS:', err);
    res.status(500).json({ error: 'Falha ao salvar imagem' });
  });

  uploadStream.on('finish', () => {
    const url = `${req.protocol}://${req.get('host')}/api/files/${uploadStream.filename}`;
    res.status(200).json({ imageUrl: url, filename: uploadStream.filename });
  });
});

/* =========================================================
   9) Download de imagem do GridFS
========================================================= */
app.get('/api/files/:filename', async (req, res) => {
  if (!gfsBucket) return res.status(503).json({ error: 'Serviço indisponível.' });

  try {
    const filename = req.params.filename;
    const files = await gfsBucket.find({ filename }).toArray();
    if (!files.length) return res.status(404).json({ error: 'Arquivo não encontrado.' });

    const file = files[0];
    const mime = file.contentType ||
      (file.metadata && (file.metadata.contentType || file.metadata.mime)) ||
      'application/octet-stream';

    res.set({
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': mime
    });

    const downloadStream = gfsBucket.openDownloadStreamByName(filename);
    downloadStream.on('error', () => res.status(404).json({ error: 'Arquivo não encontrado.' }));
    downloadStream.pipe(res);
  } catch (err) {
    console.error('❌ Erro ao ler arquivo GridFS:', err);
    res.status(500).json({ error: 'Erro ao ler arquivo no servidor.' });
  }
});

/* =========================================================
   10) Rotas de API com limiters
========================================================= */
app.use('/api/auth',     authLimiter, authRoutes);
app.use('/api/products', apiLimiter,  productRoutes);
app.use('/api/posts',    apiLimiter,  postRoutes);
app.use('/api/contact',  apiLimiter,  contactRoutes);
app.use('/api/carousel', apiLimiter,  carouselRoutes);

/* =========================================================
   11) 404 padrão
========================================================= */
app.use((req, res) => {
  res.status(404).json({ message: 'Rota não encontrada!' });
});

/* =========================================================
   12) Tratamento de erros
========================================================= */
app.use((err, req, res, next) => {
  console.error('❌ Erro interno:', err.message);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

/* =========================================================
   13) Iniciar servidor
========================================================= */
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
