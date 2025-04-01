require('dotenv').config(); // Carrega as variáveis de ambiente do .env
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');

// Import das configurações e rotas
const connectDB = require('./config/db'); // Função que faz mongoose.connect(process.env.MONGO_URI)
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const postRoutes = require('./routes/postRoutes');
const contactRoutes = require('./routes/contactRoutes');
const verifyToken = require('./middlewares/verifyToken');
const carouselRoutes = require('./routes/carouselRoutes');

// Cria a aplicação Express
const app = express();

// Porta definida no .env ou padrão 5000
const PORT = process.env.PORT || 5000;

// ======================================
// 1. Conectar ao MongoDB
// ======================================
connectDB(); 
// Certifique-se de que a função connectDB faz algo como:
// mongoose.connect(process.env.MONGO_URI).then(...).catch(...)

// ======================================
// 2. Middlewares globais
// ======================================
app.use(express.json());
app.use(helmet());

// Configura CORS usando as variáveis de ambiente se quiser restringir a domínios específicos
app.use(cors({
  origin: '*', // Ajuste para "https://seusite.com" em produção
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
// 3. Configurar Upload de Imagens (Multer)
// ======================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/'); // Pasta onde os arquivos serão salvos
  },
  filename: (req, file, cb) => {
    // Gera um nome único (timestamp + extensão)
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

// Permitir apenas imagens e limitar tamanho a 5MB
function fileFilter(req, file, cb) {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('Somente arquivos de imagem são permitidos!'), false);
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// ======================================
// 4. Servir arquivos estáticos
// ======================================
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/imagens', express.static(path.join(__dirname, 'public/imagens')));

// ======================================
// 5. Rotas iniciais e protegidas
// ======================================
app.get('/', (req, res) => {
  res.send('🚀 Servidor está funcionando e conectado ao MongoDB!');
});

// Rota de dashboard protegida por token (JWT)
app.get('/admin/dashboard', verifyToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'admin-dashboard.html'));
});

// ======================================
// 6. Rota de Upload de Imagens
// ======================================
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhuma imagem enviada!' });
  }

  // Monta a URL final para acesso ao arquivo
  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.status(200).json({ imageUrl });
});

// ======================================
// 7. Rotas da Aplicação
// ======================================
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/carousel', carouselRoutes);

// ======================================
// 8. Tratamento de rota não encontrada (404)
// ======================================
app.use((req, res) => {
  res.status(404).json({ message: 'Rota não encontrada!' });
});

// ======================================
// 9. Tratamento de erros genérico (500)
// ======================================
app.use((err, req, res, next) => {
  console.error('Erro no servidor:', err.message);
  // Se for erro de Multer (ex: arquivo muito grande ou tipo inválido), trate aqui se quiser
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

// ======================================
// 10. Iniciar o servidor
// ======================================
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
