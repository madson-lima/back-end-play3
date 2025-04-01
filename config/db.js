require('dotenv').config();
const mongoose = require('mongoose');

// Função para conectar ao MongoDB
async function connectDB() {
  try {
    // Conectando ao MongoDB usando a URI do arquivo .env
    await mongoose.connect(process.env.MONGO_URI);

    console.log('✅ Conectado ao MongoDB Atlas com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao conectar ao MongoDB:', error.message);
    process.exit(1); // Encerra o processo em caso de erro de conexão
  }
}

// Exportar a função de conexão
module.exports = connectDB;
