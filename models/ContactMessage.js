const mongoose = require('mongoose');

// Definição do esquema de mensagens de contato
const ContactMessageSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  telefone: {
    type: String
  },
  mensagem: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ContactMessage', ContactMessageSchema);
