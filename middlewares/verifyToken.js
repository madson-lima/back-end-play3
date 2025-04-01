const jwt = require('jsonwebtoken');

// ✅ Middleware para verificar o token JWT
module.exports = function verifyToken(req, res, next) {
  // Obter o token do cabeçalho Authorization
  const authHeader = req.headers['authorization'];

  // ✅ Verifica se o token foi enviado
  if (!authHeader) {
    return res.status(403).json({ error: "Acesso negado! Token não fornecido." });
  }

  // ✅ O token geralmente é enviado no formato: "Bearer <token>"
  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(403).json({ error: "Token inválido ou mal formatado!" });
  }

  try {
    // ✅ Verificar e decodificar o token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Adiciona os dados do usuário à requisição
    next(); // Prossegue para a próxima função
  } catch (err) {
    console.error("Erro ao verificar token:", err);
    return res.status(401).json({ error: "Token inválido ou expirado!" });
  }
};
