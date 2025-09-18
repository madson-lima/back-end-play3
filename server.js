require('dotenv').config();

const express       = require('express');
const helmet        = require('helmet');
const cors          = require('cors');
const rateLimit     = require('express-rate-limit');
const mongoose      = require('mongoose');
const { GridFSBucket } = require('mongodb');
const multer        = require('multer');
const path          = require('path');

// Rotas e middlewares próprios
const connectDB      = require('./config/db');
const authRoutes     = require('./routes/authRoutes');
const productRoutes  = require('./routes/productRoutes');
const postRoutes     = require('./routes/postRoutes');
const contactRoutes  = require('./routes/contactRoutes');
const carouselRoutes = require('./routes/carouselRoutes');
const verifyToken    = require('./middlewares/verifyToken');

const app  = express();
const PORT = process.env.PORT || 5000;
app.set('trust proxy', 1);

/* ---------------------------------------------
 * 1) MongoDB + GridFS
 * -------------------------------------------*/
connectDB();
let gfsBucket;
mongoose.connection.once('open', () => {
  const db = mongoose.connection.db;
  gfsBucket = new GridFSBucket(db, { bucketName: 'uploads' });
  console.log('✅ GridFSBucket inicializado');
});

/* ---------------------------------------------
 * 2) Middlewares globais
 *    - CORS liberado
 *    - JSON
 *    - Helmet sem COEP e com CORP = cross-origin
 * -------------------------------------------*/
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.options('*', cors());

app.use(express.json());

app.use(helmet({
  crossOriginEmbedderPolicy: false,                // não exige COEP
  crossOriginResourcePolicy: { policy: 'cross-origin' } // libera incorporação cross-origin
}));

/* ---------------------------------------------
 * 3) Rate limiters
 * -------------------------------------------*/
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de autenticação. Aguarde alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: 1
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Muitas requisições em pouco tempo. Tente novamente em instantes.' },
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: 1
});

/* ---------------------------------------------
 * 4) Estáticos
 * -------------------------------------------*/
app.use(express.static(path.join(__dirname, 'public')));
app.use('/pages', express.static(path.join(__dirname, 'pages')));
// (opcional) se tiver pasta local de imagens:
app.use('/imagens', express.static(path.join(__dirname, 'imagens'), {
  setHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

/* ---------------------------------------------
 * 5) Rotas simples
 * -------------------------------------------*/
app.get('/', (req, res) => res.send('🚀 API e MongoDB OK!'));
app.get('/admin/dashboard', verifyToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'admin-dashboard.html'));
});

/* ---------------------------------------------
 * 6) Multer (upload em memória)
 * -------------------------------------------*/
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Somente imagens são permitidas!'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

/* ---------------------------------------------
 * 7) Upload para GridFS
 *    - salva contentType e metadata.contentType
 * -------------------------------------------*/
app.post('/api/upload', apiLimiter, upload.single('image'), (req, res) => {
  if (!gfsBucket) {
    return res.status(503).json({ error: 'Banco de arquivos não pronto. Tente novamente mais tarde.' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhuma imagem enviada!' });
  }

  const filename = `upload_${Date.now()}${path.extname(req.file.originalname || '')}`;
  const uploadStream = gfsBucket.openUploadStream(filename, {
    contentType: req.file.mimetype,
    metadata: { contentType: req.file.mimetype }
  });

  uploadStream.end(req.file.buffer);

  uploadStream.on('error', err => {
    console.error('❌ Erro no upload GridFS:', err);
    res.status(500).json({ error: 'Falha ao salvar imagem no servidor.' });
  });

  uploadStream.on('finish', () => {
    const url = `${req.protocol}://${req.get('host')}/api/files/${uploadStream.filename}`;
    res.status(200).json({ imageUrl: url, filename: uploadStream.filename });
  });
});

/* ---------------------------------------------
 * 8) Download do GridFS
 *    - headers CORS/CORP + Content-Type correto
 *    - cache 1h
 * -------------------------------------------*/
app.get('/api/files/:filename', async (req, res) => {
  if (!gfsBucket) {
    return res.status(503).json({ error: 'Serviço indisponível.' });
  }

  try {
    const filename = req.params.filename;

    const files = await gfsBucket.find({ filename }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ error: 'Arquivo não encontrado.' });
    }

    const file = files[0];
    const mime =
      file.contentType ||
      (file.metadata && (file.metadata.contentType || file.metadata.mime)) ||
      'application/octet-stream';

    res.set({
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': mime
      // 'Timing-Allow-Origin': '*' // opcional
    });

    const downloadStream = gfsBucket.openDownloadStreamByName(filename);

    downloadStream.on('error', (err) => {
      console.error('Erro no stream GridFS:', err);
      if (!res.headersSent) {
        res.status(404).json({ error: 'Arquivo não encontrado.' });
      } else {
        res.end();
      }
    });

    downloadStream.pipe(res);
  } catch (err) {
    console.error('❌ Erro ao ler arquivo GridFS:', err);
    res.status(500).json({ error: 'Erro ao ler arquivo no servidor.' });
  }
});

/* ---------------------------------------------
 * 9) Rotas de API com limiters
 * -------------------------------------------*/
app.use('/api/auth',     authLimiter, authRoutes);
app.use('/api/products', apiLimiter,  productRoutes);
app.use('/api/posts',    apiLimiter,  postRoutes);
app.use('/api/contact',  apiLimiter,  contactRoutes);
app.use('/api/carousel', apiLimiter,  carouselRoutes);

/* ---------------------------------------------
 * 10) 404
 * -------------------------------------------*/
app.use((req, res) => {
  res.status(404).json({ message: 'Rota não encontrada!' });
});

/* ---------------------------------------------
 * 11) Handler de erros
 * -------------------------------------------*/
app.use((err, req, res, next) => {
  console.error('❌ Erro interno:', err.message);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

/* ---------------------------------------------
 * 12) Start
 * -------------------------------------------*/
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
