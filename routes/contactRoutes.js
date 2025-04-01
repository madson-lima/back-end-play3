const express = require('express');
const { body } = require('express-validator');
const contactController = require('../controllers/contactController'); 
const verifyToken = require('../middlewares/verifyToken'); // Middleware de autenticação

const router = express.Router();

// Rota para enviar mensagem de contato
router.post('/contact', [
  body('nome').notEmpty().withMessage('O nome é obrigatório'),
  body('email').isEmail().withMessage('Insira um e-mail válido'),
  body('telefone').optional().isMobilePhone().withMessage('Número de telefone inválido'),
  body('mensagem').notEmpty().withMessage('A mensagem não pode estar vazia')
], contactController.sendMessage);

// Rota para listar todas as mensagens (restrita ao admin)
router.get('/messages', verifyToken, contactController.getAllMessages);

// Rota para deletar uma mensagem pelo ID (restrita ao admin)
router.delete('/messages/:id', verifyToken, contactController.deleteMessage);

module.exports = router;
