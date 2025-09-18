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
app.set('trust proxy', 1);
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

// ⚠️ Helmet ajustado para permitir incorporação cross-origin (CORP)
app.use(helmet({
  crossOriginEmbedderPolicy: false,              // não exige COEP
  crossOriginResourcePolicy: { policy: 'cross-origin' } // libera recursos para outros domínios
}));

/*------------------------------------------------------------
  3) Definição de rate limiters específicos
------------------------------------------------------------*/
// 10 req / 15 min para rotas sensíveis (auth)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de autenticação. Aguarde alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: 1
});

// 1000 req / 15 min para demais rotas
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Muitas requisições em pouco tempo. Tente novamente em instantes.' },
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: 1
});

/*------------------------------------------------------------
  4) Servir arquivos estáticos (sem rate limit)
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
  6) Multer (upload em memória) para GridFS
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

  const filename = `upload_${Date.now()}${path.extname(req.file.originalname || '')}`;
  // salva também o mime em metadata (além de contentType) para compatibilidade
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

/*------------------------------------------------------------
  8) Download de imagem do GridFS em /api/files/:filename
     - Define headers que liberam uso cross-origin (CORS/CORP)
     - Define Content-Type correto
     - Cache de 1 hora
------------------------------------------------------------*/
app.get('/api/files/:filename', async (req, res) => {
  if (!gfsBucket) {
    return res.status(503).json({ error: 'Serviço indisponível.' });
  }

  try {
    const filename = req.params.filename;

    // Busca metadados do arquivo para obter o mime correto
    const files = await gfsBucket.find({ filename }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ error: 'Arquivo não encontrado.' });
    }

    const file = files[0];
    const mime =
      file.contentType ||
      (file.metadata && (file.metadata.contentType || file.metadata.mime)) ||
      'application/octet-stream';

    // ✅ headers que evitam ERR_BLOCKED_BY_RESPONSE.NotSameOrigin
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

/*------------------------------------------------------------
  9) Aplicar rateLimiter apenas nas rotas de API
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
