require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const multer = require('multer');
const path = require('path');

// Rotas e configurações
const connectDB      = require('./config/db');
const authRoutes     = require('./routes/authRoutes');
const productRoutes  = require('./routes/productRoutes');
const postRoutes     = require('./routes/postRoutes');
const contactRoutes  = require('./routes/contactRoutes');
const carouselRoutes = require('./routes/carouselRoutes');
const verifyToken    = require('./middlewares/verifyToken');

const app = express();
app.set('trust proxy', 1); // confia no primeiro proxy
const PORT = process.env.PORT || 5000;

/*------------------------------------------------------------
  1) Conectar ao MongoDB + inicializar o GridFSBucket
------------------------------------------------------------*/
connectDB();
let gfsBucket;
mongoose.connection.once('open', () => {
  const db = mongoose.connection.db;
  gfsBucket = new GridFSBucket(db, { bucketName: 'uploads' });
  console.log('✅ GridFSBucket inicializado');
});

/*------------------------------------------------------------
  2) Middlewares gerais: CORS, JSON e Helmet
------------------------------------------------------------*/
app.use(
  cors({
    origin: '*',
    methods: ['GET','POST','PUT','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization']
  })
);
app.options('*', cors());
app.use(express.json());
app.use(helmet());

/*------------------------------------------------------------
  3) Definição de rate limiters específicos
------------------------------------------------------------*/
// Limiter restrito para endpoints de autenticação ou rotas sensíveis (ex.: login)
// 10 requisições a cada 15 minutos por IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  message: { error: 'Muitas tentativas de autenticação. Aguarde alguns minutos antes de tentar novamente.' },
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: 1
});

// Limiter mais flexível para demais rotas de API (CRUD, uploads, listagens, etc.)
// 1000 requisições a cada 15 minutos por IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000,
  message: { error: 'Muitas requisições em pouco tempo. Tente novamente em alguns instantes.' },
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: 1
});

/*------------------------------------------------------------
  4) Servir arquivos estáticos SEM rate limit
------------------------------------------------------------*/
app.use(express.static(path.join(__dirname, 'public')));
app.use('/pages', express.static(path.join(__dirname, 'pages')));

/*------------------------------------------------------------
  5) Rota de status e dashboard protegida
------------------------------------------------------------*/
app.get('/', (req, res) => res.send('🚀 API e MongoDB OK!'));
app.get('/admin/dashboard', verifyToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'admin-dashboard.html'));
});

/*------------------------------------------------------------
  6) Configurar Multer para upload em memória (GridFS)
------------------------------------------------------------*/
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

/*------------------------------------------------------------
  7) Upload de imagem para GridFS em /api/upload (com apiLimiter)
------------------------------------------------------------*/
app.post('/api/upload', apiLimiter, upload.single('image'), (req, res) => {
  if (!gfsBucket) {
    return res
      .status(503)
      .json({ error: 'Banco de arquivos não pronto. Tente novamente mais tarde.' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhuma imagem enviada!' });
  }

  const filename = `upload_${Date.now()}${path.extname(req.file.originalname)}`;
  const uploadStream = gfsBucket.openUploadStream(filename, { contentType: req.file.mimetype });
  uploadStream.end(req.file.buffer);

  uploadStream.on('error', err => {
    console.error('❌ Erro no upload GridFS:', err);
    res.status(500).json({ error: 'Falha ao salvar imagem no servidor.' });
  });

  uploadStream.on('finish', () => {
    const url = `${req.protocol}://${req.get('host')}/api/files/${uploadStream.filename}`;
    res.status(200).json({ imageUrl: url });
  });
});

/*------------------------------------------------------------
  8) Download de imagem do GridFS em /api/files/:filename SEM rate limit
     Adiciona cabeçalho de cache (1 hora) para reduzir hits no servidor
------------------------------------------------------------*/
app.get('/api/files/:filename', (req, res) => {
  if (!gfsBucket) {
    return res.status(503).json({ error: 'Serviço indisponível.' });
  }
  try {
    // Configurar cache no lado do cliente (1 hora = 3600 segundos)
    res.set('Cache-Control', 'public, max-age=3600');
    // Ajustar Content-Type conforme o tipo de imagem
    // Se preferir, detecte dinamicamente: res.set('Content-Type', req.query.contentType || 'image/jpeg');
    res.set('Content-Type', 'image/jpeg');

    const downloadStream = gfsBucket.openDownloadStreamByName(req.params.filename);
    downloadStream.pipe(res);
    downloadStream.on('error', () => res.status(404).json({ error: 'Arquivo não encontrado.' }));
  } catch (err) {
    console.error('❌ Erro ao ler arquivo GridFS:', err);
    res.status(500).json({ error: 'Erro ao ler arquivo no servidor.' });
  }
});

/*------------------------------------------------------------
  9) Aplicar rateLimiter apenas nas rotas de API sensíveis
------------------------------------------------------------*/
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/products', apiLimiter, productRoutes);
app.use('/api/posts', apiLimiter, postRoutes);
app.use('/api/contact', apiLimiter, contactRoutes);
app.use('/api/carousel', apiLimiter, carouselRoutes);

/*------------------------------------------------------------
 10) Rota 404 genérica
------------------------------------------------------------*/
app.use((req, res) => {
  res.status(404).json({ message: 'Rota não encontrada!' });
});

/*------------------------------------------------------------
 11) Tratamento de erros internos
------------------------------------------------------------*/
app.use((err, req, res, next) => {
  console.error('❌ Erro interno:', err.message);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

/*------------------------------------------------------------
 12) Iniciar o servidor
------------------------------------------------------------*/
app.listen(PORT, () => console.log(`🚀 Servidor rodando em http://localhost:${PORT}`));
