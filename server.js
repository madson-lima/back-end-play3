require('dotenv').config(); // Carrega as variáveis de ambiente do .env
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

// Import das configurações e rotas
const connectDB = require('./config/db'); // Função que faz mongoose.connect(process.env.MONGO_URI)
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const postRoutes = require('./routes/postRoutes');
const contactRoutes = require('./routes/contactRoutes');
const verifyToken = require('./middlewares/verifyToken');
const carouselRoutes = require('./routes/carouselRoutes');

// Cria a aplicação Express
tmp = express();
const app = express();

// ⚠️ Habilita o trust proxy para que req.protocol reflita HTTPS em produção
app.set('trust proxy', true);

// Porta definida no .env ou padrão 5000
const PORT = process.env.PORT || 5000;

// ======================================
// 1. Conectar ao MongoDB
// ======================================
connectDB(); 
// Certifique-se de que a função connectDB faz algo como:
// mongoose.connect(process.env.MONGO_URI).then(...).catch(...)

// Inicializa o GridFSBucket assim que a conexão for aberta
let gfsBucket;
mongoose.connection.once('open', () => {
  const db = mongoose.connection.db;
  gfsBucket = new GridFSBucket(db, {
    bucketName: 'uploads'
  });
  console.log('✅ GridFSBucket inicializado');
});

// ======================================
// 2. Middlewares globais
// ======================================
app.use(express.json());
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','Origin','X-Requested-With','Accept'],
  credentials: true
}));

// Limite de requisições (rate limiting)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // Máximo de 100 requisições por IP
});
app.use(limiter);

// ======================================
// 3. Configurar Upload de Imagens via GridFS
// ======================================

// Filtra apenas imagens
function fileFilter(req, file, cb) {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('Somente arquivos de imagem são permitidos!'), false);
  }
  cb(null, true);
}

// Usa memória para armazenar temporariamente antes de enviar ao GridFS
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// ======================================
// 4. Servir arquivos estáticos (imagens fixas)
// ======================================
app.use('/imagens', express.static(path.join(__dirname, 'public/imagens')));

// ======================================
// 5. Rotas iniciais e protegidas
// ======================================
app.get('/', (req, res) => {
  res.send('🚀 Servidor está funcionando e conectado ao MongoDB!');
});

app.get('/admin/dashboard', verifyToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'admin-dashboard.html'));
});

// ======================================
// 6. Rota de Upload de Imagens (GridFS)
// ======================================
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhuma imagem enviada!' });
  }

  // Cria um stream de upload para o GridFS
  const uploadStream = gfsBucket.openUploadStream(
    `${Date.now()}_${req.file.originalname}`,
    { contentType: req.file.mimetype }
  );

  // Escreve o buffer da imagem no GridFS
  uploadStream.end(req.file.buffer);

  uploadStream.on('error', err => {
    console.error('Erro no GridFS upload:', err);
    res.status(500).json({ error: 'Erro ao salvar no GridFS' });
  });

  uploadStream.on('finish', file => {
    // Retorna a URL para acesso via rota de download
    const imageUrl = `${req.protocol}://${req.get('host')}/api/files/${file.filename}`;
    res.status(200).json({ imageUrl });
  });
});

// ======================================
// 7. Rota para servir arquivos do GridFS
// ======================================
app.get('/api/files/:filename', async (req, res) => {
  try {
    const downloadStream = gfsBucket.openDownloadStreamByName(req.params.filename);
    res.set('Content-Type', 'application/octet-stream');
    downloadStream.pipe(res);
    downloadStream.on('error', () => res.status(404).json({ error: 'Arquivo não encontrado' }));
  } catch (err) {
    console.error('Erro ao ler arquivo no GridFS:', err);
    res.status(500).json({ error: 'Erro ao ler o arquivo' });
  }
});

// ======================================
// 8. Rotas da Aplicação
// ======================================
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/carousel', carouselRoutes);

// ======================================
// 9. Rota não encontrada (404)
// ======================================
app.use((req, res) => {
  res.status(404).json({ message: 'Rota não encontrada!' });
});

// ======================================
// 10. Tratamento de erros genérico (500)
// ======================================
app.use((err, req, res, next) => {
  console.error('Erro no servidor:', err.message);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

// ======================================
// 11. Iniciar o servidor
// ======================================
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
