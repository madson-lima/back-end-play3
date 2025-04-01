const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const mongoose = require('mongoose');
const productController = require('../controllers/productController');
const verifyToken = require('../middlewares/verifyToken'); // Verifique o caminho do arquivo

const router = express.Router();

// 📌 Configurar o armazenamento do multer para upload de imagens
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/'); // Pasta onde as imagens serão armazenadas
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname); // Nome do arquivo com timestamp
  }
});

const upload = multer({ storage });

// 📌 Criar Produto com Upload de Imagem (com autenticação)
router.post(
  '/upload',
  verifyToken, // Apenas admin autenticado pode criar produto
  upload.single('image'), // Enviar uma única imagem
  [
    body('name').notEmpty().withMessage('O nome do produto é obrigatório'),
    body('description').notEmpty().withMessage('A descrição é obrigatória'),
  ],
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Imagem não enviada.' });
    }

    const { name, description, price } = req.body;
    const imageUrl = `https://totalfilter-backend-production.up.railway.app/uploads/${req.file.filename}`;

    // Se o preço não for informado, permanece como string vazia
    const newProduct = {
      name,
      description,
      price: price || '', 
      imageUrl
    };

    productController.createProduct(req, res, newProduct);
  }
);

// 📌 Criar Produto via URL de Imagem (PROTEGIDO)
router.post(
  '/',
  verifyToken, // Apenas admin autenticado pode criar produto
  [
    body('name').notEmpty().withMessage('O nome do produto é obrigatório'),
    body('description').notEmpty().withMessage('A descrição é obrigatória'),
    body('price').isNumeric().withMessage('O preço deve ser um número'),
    body('imageUrl').notEmpty().withMessage('A URL da imagem é obrigatória')
  ],
  productController.createProduct
);

// 📌 Listar novos lançamentos (sem necessidade de autenticação)
router.get('/new-releases', productController.getNewReleases);

// 📌 Listar todos os produtos (sem necessidade de autenticação)
router.get('/', productController.getAllProducts);

// 📌 Obter produto por ID (com validação de ID)
router.get('/:id', (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: 'ID inválido!' });
  }
  next();
}, productController.getProductById);

// 📌 Atualizar Produto (PROTEGIDO)
router.put(
  '/:id',
  verifyToken, // Apenas admin autenticado pode atualizar produto
  [
    body('name').notEmpty().withMessage('O nome do produto é obrigatório'),
    body('description').notEmpty().withMessage('A descrição é obrigatória'),
    body('price').isNumeric().withMessage('O preço deve ser um número'),
    body('imageUrl').notEmpty().withMessage('A URL da imagem é obrigatória')
  ],
  productController.updateProduct
);

// 📌 Deletar Produto (PROTEGIDO)
router.delete('/:id', verifyToken, productController.deleteProduct);

module.exports = router;
