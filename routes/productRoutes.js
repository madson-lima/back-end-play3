// routes/productRoutes.js

const express  = require('express');
const { body } = require('express-validator');
const multer   = require('multer');
const mongoose = require('mongoose');

const productController = require('../controllers/productController');
const verifyToken       = require('../middlewares/verifyToken');

const router = express.Router();

// ─── Configuração do Multer ─────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// ─── ROTA: Upload de imagem + criação de produto ─────────
// Usa uma função inline para montar overrideData e chamar o controller
router.post(
  '/upload',
  verifyToken,
  upload.single('image'),
  [
    body('name').notEmpty().withMessage('O nome do produto é obrigatório'),
    body('description').notEmpty().withMessage('A descrição é obrigatória'),
    // price e isNewRelease podem vir vazios
  ],
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Imagem não enviada.' });
    }

    const { name, description, price, isNewRelease } = req.body;
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    // Monta o objeto para o controller
    const overrideData = {
      name,
      description,
      price: price || '',
      imageUrl,
      isNewRelease: isNewRelease === 'true' || isNewRelease === true
    };

    // Chama o controller passando overrideData
    return productController.createProduct(req, res, overrideData);
  }
);

// ─── ROTA: Criação via JSON puro ──────────────────────────
router.post(
  '/',
  verifyToken,
  [
    body('name').notEmpty().withMessage('O nome do produto é obrigatório'),
    body('description').notEmpty().withMessage('A descrição é obrigatória'),
    body('imageUrl').notEmpty().withMessage('A URL da imagem é obrigatória'),
    body('price').optional().isNumeric().withMessage('O preço deve ser numérico'),
    body('isNewRelease').optional().isBoolean().withMessage('isNewRelease deve ser booleano'),
  ],
  productController.createProduct
);

// ─── ROTA: Listar novos lançamentos (público) ───────────
router.get('/new-releases', productController.getNewReleases);

// ─── ROTA: Listar todos os produtos (com paginação, público) ───
router.get('/', productController.getAllProducts);

// ─── ROTA: Buscar produto por ID ───────────────────────────
// Deve vir após '/' e '/new-releases' para não conflitar
router.get(
  '/:id',
  (req, res, next) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'ID inválido!' });
    }
    next();
  },
  productController.getProductById
);

// ─── ROTA: Atualizar produto (PROTEGIDO) ───────────────────
router.put(
  '/:id',
  verifyToken,
  [
    body('name').notEmpty().withMessage('O nome do produto é obrigatório'),
    body('description').notEmpty().withMessage('A descrição é obrigatória'),
    body('imageUrl').notEmpty().withMessage('A URL da imagem é obrigatória'),
    body('price').optional().isNumeric().withMessage('O preço deve ser numérico'),
    body('isNewRelease').optional().isBoolean().withMessage('isNewRelease deve ser booleano'),
  ],
  productController.updateProduct
);

// ─── ROTA: Deletar produto (PROTEGIDO) ────────────────────
router.delete('/:id', verifyToken, productController.deleteProduct);

module.exports = router;
