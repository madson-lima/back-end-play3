const mongoose = require('mongoose');

// Definindo o Schema do Produto
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: String, default: "" }, // Permite string vazia
  imageUrl: { type: String, required: true }
});

// Exporta o modelo para ser usado em outras partes do projeto
module.exports = mongoose.model('Product', productSchema);
