const { body, validationResult } = require('express-validator');
const ContactMessage = require('../models/ContactMessage');


// Função para enviar uma nova mensagem de contato
exports.sendMessage = async (req, res) => {
  // Validação dos dados recebidos
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { nome, email, telefone, mensagem } = req.body;

  try {
    // Criando uma nova mensagem
    const newMessage = new ContactMessage({
      nome,
      email,
      telefone,
      mensagem
    });

    // Salvando no banco de dados
    await newMessage.save();
    res.status(201).json({ message: "Mensagem enviada com sucesso!" });
  } catch (err) {
    console.error("Erro ao enviar mensagem:", err);
    res.status(500).json({ error: "Erro ao enviar a mensagem!" });
  }
};

// Função para listar todas as mensagens de contato
exports.getAllMessages = async (req, res) => {
  try {
    const messages = await ContactMessage.find().sort({ date: -1 }); // Lista as mensagens em ordem decrescente
    res.status(200).json(messages);
  } catch (err) {
    console.error("Erro ao buscar mensagens:", err);
    res.status(500).json({ error: "Erro ao buscar mensagens de contato!" });
  }
};

// Função para deletar uma mensagem específica
exports.deleteMessage = async (req, res) => {
  try {
    const messageId = req.params.id;
    await ContactMessage.findByIdAndDelete(messageId);
    res.status(200).json({ message: "Mensagem deletada com sucesso!" });
  } catch (err) {
    console.error("Erro ao deletar mensagem:", err);
    res.status(500).json({ error: "Erro ao deletar mensagem de contato!" });
  }
};
