require('dotenv').config(); // Carrega variáveis de ambiente do .env
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const multer = require('multer');
const path = require('path');

// Import das configurações e rotas
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const postRoutes = require('./routes/postRoutes');
const contactRoutes = require('./routes/contactRoutes');
const carouselRoutes = require('./routes/carouselRoutes');
const verifyToken = require('./middlewares/verifyToken');

// Cria a aplicação Express
const app = express();
app.set('trust proxy', true); // certifique-se de refletir HTTPS em ambiente de proxy
const PORT = process.env.PORT || 5000;

// 1) Conectar ao MongoDB e inicializar GridFSBucket
connectDB();
let gfsBucket;
mongoose.connection.once('open', () => {
  const db = mongoose.connection.db;
  gfsBucket = new GridFSBucket(db, { bucketName: 'uploads' });
  console.log('✅ GridFSBucket inicializado');
});

// 2) Middlewares globais
app.use(express.json());
app.use(helmet());
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'], credentials: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// 3) Configurar Upload em memória via Multer
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Somente imagens são permitidas'), false);
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// 4) Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public'))); // CSS, JS, imagens estáticas
app.use('/pages', express.static(path.join(__dirname, 'pages'))); // HTML públicos

// 5) Rotas iniciais
app.get('/', (req, res) => res.send('🚀 Servidor conectado ao MongoDB e pronto para GridFS!'));
app.get('/admin/dashboard', verifyToken, (req, res) => res.sendFile(path.join(__dirname, 'pages', 'admin-dashboard.html')));

// 6) Rota de Upload via GridFS
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada!' });

  const uploadStream = gfsBucket.openUploadStream(
    `upload_${Date.now()}${path.extname(req.file.originalname)}`,
    { contentType: req.file.mimetype }
  );
  uploadStream.end(req.file.buffer);

  uploadStream.on('error', err => {
    console.error('❌ Erro no upload GridFS:', err);
    res.status(500).json({ error: 'Erro ao salvar no GridFS' });
  });

  uploadStream.on('finish', file => {
    const imageUrl = `${req.protocol}://${req.get('host')}/api/files/${file.filename}`;
    res.status(200).json({ imageUrl });
  });
});

// 7) Rota para servir arquivos do GridFS
app.get('/api/files/:filename', (req, res) => {
  try {
    const downloadStream = gfsBucket.openDownloadStreamByName(req.params.filename);
    res.set('Content-Type', 'application/octet-stream');
    downloadStream.pipe(res);
    downloadStream.on('error', () => res.status(404).json({ error: 'Arquivo não encontrado' }));
  } catch (err) {
    console.error('❌ Erro ao ler arquivo GridFS:', err);
    res.status(500).json({ error: 'Erro ao ler o arquivo' });
  }
});

// 8) Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/carousel', carouselRoutes);

// 9) 404 geral
app.use((req, res) => res.status(404).json({ message: 'Rota não encontrada!' }));

// 10) Tratamento de erros
app.use((err, req, res, next) => {
  console.error('❌ Erro interno:', err.message);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

// 11) Iniciar servidor
app.listen(PORT, () => console.log(`🚀 Servidor rodando em http://localhost:${PORT}`));
