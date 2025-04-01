require('dotenv').config();
console.log("MONGO_URI:", process.env.MONGO_URI);
const mongoose = require('mongoose');
const User = require('../models/User'); // Modelo sem bcrypt (senha em texto puro)

// ✅ Conectar ao MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ Conectado ao MongoDB'))
  .catch(err => console.error('❌ Erro ao conectar ao MongoDB:', err));

// ✅ Criar novo usuário (sem bcrypt)
async function createAdminUser() {
  try {
    const username = "admin";
    const password = "admin123"; // Senha em texto puro

    // Verificar se o usuário já existe
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      console.log("⚠️ Usuário já existe.");
      mongoose.connection.close();
      return;
    }

    // Criar novo usuário (senha em texto puro)
    const newUser = new User({
      username,
      password,  // armazenado exatamente como "admin123"
      role: "admin"
    });

    await newUser.save();
    console.log("✅ Usuário admin criado com sucesso (sem bcrypt)!");
    mongoose.connection.close();
  } catch (error) {
    console.error("❌ Erro ao criar usuário:", error);
    mongoose.connection.close();
  }
}

// ✅ Executar a função
createAdminUser();
