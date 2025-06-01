const mongoose = require('mongoose');

// Definindo o Schema do Produto, agora com o campo isLaunch
const productSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String, 
    required: true 
  },
  price: { 
    type: String, 
    default: ""  // mantém a possibilidade de string vazia
  },
  imageUrl: { 
    type: String, 
    required: true 
  },
  // ─── NOVO CAMPO: indica se este produto deve aparecer em “Lançamentos” ───
  isLaunch: {
    type: Boolean,
    default: false
  }
},
{
  timestamps: true
});

module.exports = mongoose.model('Product', productSchema);
