const express = require('express');
const { body } = require('express-validator');
const postController = require('../controllers/postController'); // Caminho correto
const verifyToken = require('../middlewares/verifyToken'); // Middleware de autenticação

const router = express.Router();

// 📌 Criar Post (necessário token)
router.post(
  '/',
  verifyToken,
  [
    body('title').notEmpty().withMessage('O título é obrigatório'),
    body('content').notEmpty().withMessage('O conteúdo é obrigatório')
  ],
  postController.createPost
);

// ✅ Obter todos os posts
router.get('/', verifyToken, postController.getAllPosts);

// 📌 Obter post por ID
router.get('/:id', postController.getPostById);

// 📌 Atualizar Post (necessário token)
router.put(
  '/:id',
  verifyToken,
  [
    body('title').notEmpty().withMessage('O título é obrigatório'),
    body('content').notEmpty().withMessage('O conteúdo é obrigatório')
  ],
  postController.updatePost
);

// 📌 Deletar Post (necessário token)
router.delete('/:id', verifyToken, postController.deletePost);

module.exports = router;
