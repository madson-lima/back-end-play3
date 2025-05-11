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

// Rotas
const connectDB = require('./config/db');
const authRoutes      = require('./routes/authRoutes');
const productRoutes   = require('./routes/productRoutes');
const postRoutes      = require('./routes/postRoutes');
const contactRoutes   = require('./routes/contactRoutes');
const carouselRoutes  = require('./routes/carouselRoutes');
const verifyToken     = require('./middlewares/verifyToken');

const app = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 5000;

// 1) Conecta ao MongoDB e inicializa GridFSBucket
connectDB();
let gfsBucket;
mongoose.connection.once('open', () => {
  const db = mongoose.connection.db;
  gfsBucket = new GridFSBucket(db, { bucketName: 'uploads' });
  console.log('✅ GridFSBucket pronto!');
});

// 2) Middlewares globais
app.use(express.json());
app.use(helmet());
// **CORS**: permite chamadas do seu domínio (e de qualquer outro, se quiser)
app.use(cors({
  origin: [ 'https://totalfilter.com.br', 'https://back-end-play3-production.up.railway.app' ],
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true
}));
// Rate limiting
app.use(rateLimit({ windowMs: 15*60*1000, max: 100 }));

// 3) Multer em memória (para GridFS)
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Somente imagens são permitidas'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 5*1024*1024 }
});

// 4) Servir arquivos estáticos
//    - public/: /css, /script, /imagens, /uploads (se vier do disco)
//    - pages/: HTML das suas páginas
app.use(express.static(path.join(__dirname, 'public')));
app.use('/pages', express.static(path.join(__dirname, 'pages')));

// 5) Rotas de status e dashboard
app.get('/', (req, res) => res.send('🚀 API e MongoDB OK!'));
app.get('/admin/dashboard', verifyToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'admin-dashboard.html'));
});

// 6) Upload para GridFS
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhuma imagem enviada!' });
  }
  const filename = `upload_${Date.now()}${path.extname(req.file.originalname)}`;
  const stream = gfsBucket.openUploadStream(filename, {
    contentType: req.file.mimetype
  });
  stream.end(req.file.buffer);
  stream.on('error', err => {
    console.error('❌ GridFS upload error:', err);
    res.status(500).json({ error: 'Erro ao salvar imagem.' });
  });
  stream.on('finish', file => {
    const imageUrl = `${req.protocol}://${req.get('host')}/api/files/${file.filename}`;
    res.json({ imageUrl });
  });
});

// 7) Servir imagem do GridFS
app.get('/api/files/:filename', (req, res) => {
  try {
    const download = gfsBucket.openDownloadStreamByName(req.params.filename);
    download.on('error', () => res.status(404).json({ error: 'Arquivo não encontrado' }));
    res.set('Content-Type', 'application/octet-stream');
    download.pipe(res);
  } catch (err) {
    console.error('❌ GridFS read error:', err);
    res.status(500).json({ error: 'Erro ao ler arquivo.' });
  }
});

// 8) Rotas de API
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/carousel', carouselRoutes);

// 9) 404 genérico
app.use((req, res) => {
  res.status(404).json({ message: 'Rota não encontrada!' });
});

// 10) Tratamento de erros
app.use((err, req, res, next) => {
  console.error('❌ Erro interno:', err.message);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

// 11) Inicia o servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
