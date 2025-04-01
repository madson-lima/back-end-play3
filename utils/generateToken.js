const jwt = require('jsonwebtoken');

// Função para gerar um token JWT
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id, // ID do usuário no MongoDB
      username: user.username, // Nome de usuário
      role: user.role // Permissão (admin/user)
    },
    process.env.SECRET_KEY, // Chave secreta armazenada no arquivo .env
    {
      expiresIn: '1h' // Definindo validade do token (1 hora)
    }
  );
};

module.exports = generateToken;
