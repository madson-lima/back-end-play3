// server.js

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
app.set('trust proxy', true); // permite capturar req.protocol corretamente atrás de proxies
const PORT = process.env.PORT || 5000;

// 1) Conectar ao MongoDB e inicializar GridFSBucket
connectDB();
let gfsBucket;
mongoose.connection.once('open', () => {
  const db = mongoose.connection.db;
  gfsBucket = new GridFSBucket(db, { bucketName: 'uploads' });
  console.log('✅ GridFSBucket inicializado');
});

// 2) Middlewares globais (CORS em primeiro lugar)
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

// Rate limiter com permissão explícita para trust proxy
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100,                 // 100 requisições por IP
    trustProxy: true          // explicita que confia no X-Forwarded-For
  })
);

// 3) Configurar Multer para upload em memória (GridFS)
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

// 4) Servir arquivos estáticos (CSS, JS, etc.)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/pages', express.static(path.join(__dirname, 'pages')));

// 5) Status e rota protegida do dashboard
app.get('/', (req, res) => res.send('🚀 API e MongoDB OK!'));
app.get('/admin/dashboard', verifyToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'admin-dashboard.html'));
});

// 6) Upload para GridFS
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!gfsBucket) {
    return res
      .status(503)
      .json({ error: 'Banco de arquivos ainda não pronto. Tente novamente.' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhuma imagem enviada!' });
  }

  const filename = `upload_${Date.now()}${path.extname(req.file.originalname)}`;
  const uploadStream = gfsBucket.openUploadStream(filename, { contentType: req.file.mimetype });
  uploadStream.end(req.file.buffer);

  uploadStream.on('error', err => {
    console.error('❌ Erro no upload GridFS:', err);
    res.status(500).json({ error: 'Falha ao salvar imagem.' });
  });

  uploadStream.on('finish', file => {
    const imageUrl = `${req.protocol}://${req.get('host')}/api/files/${file.filename}`;
    res.status(200).json({ imageUrl });
  });
});

// 7) Servir arquivos do GridFS
app.get('/api/files/:filename', (req, res) => {
  if (!gfsBucket) {
    return res.status(503).json({ error: 'Serviço indisponível.' });
  }
  try {
    const downloadStream = gfsBucket.openDownloadStreamByName(req.params.filename);
    res.set('Content-Type', 'application/octet-stream');
    downloadStream.pipe(res);
    downloadStream.on('error', () => res.status(404).json({ error: 'Arquivo não encontrado.' }));
  } catch (err) {
    console.error('❌ Erro ao ler arquivo GridFS:', err);
    res.status(500).json({ error: 'Erro ao ler arquivo.' });
  }
});

// 8) Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/carousel', carouselRoutes);

// 9) 404 genérico
app.use((req, res) => res.status(404).json({ message: 'Rota não encontrada!' }));

// 10) Tratamento de erros
app.use((err, req, res, next) => {
  console.error('❌ Erro interno:', err.message);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

// 11) Inicia o servidor
app.listen(PORT, () => console.log(`🚀 Servidor rodando em http://localhost:${PORT}`));
