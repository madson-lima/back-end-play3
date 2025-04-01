const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Modelo de usuário sem bcrypt (senha em texto puro)

// ======================================
// ✅ Função de Login (sem bcrypt)
// ======================================
exports.login = async (req, res) => {
  const { username, password } = req.body;

  // Verificação de campos
  if (!username || !password) {
    return res.status(400).json({ error: "Por favor, preencha todos os campos." });
  }

  try {
    // Verifica se o usuário existe
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: "Usuário não encontrado." });
    }

    // ❌ Comparação literal (texto puro)
    if (password !== user.password) {
      return res.status(401).json({ error: "Senha inválida." });
    }

    // Gera o token JWT (certifique-se de ter process.env.JWT_SECRET definido no .env)
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET, 
      { expiresIn: '8h' }
    );

    // Retorna token e role para o front-end
    res.status(200).json({
      message: "Login realizado com sucesso.",
      token,
      role: user.role
    });
  } catch (error) {
    console.error("Erro no login:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
};

// ======================================
// ✅ Função de Validação de Token
// ======================================
exports.validateToken = (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Token não fornecido." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.status(200).json({
      valid: true,
      userId: decoded.id,
      role: decoded.role
    });
  } catch (error) {
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
};

// ======================================
// ✅ Função de Logout
// ======================================
exports.logout = (req, res) => {
  // Em JWT, não há sessão no servidor para encerrar
  // O logout ocorre removendo o token do lado do cliente (localStorage, cookies, etc.)
  res.status(200).json({ message: "Logout realizado com sucesso." });
};

// ======================================
// ✅ Criar Usuário Admin (sem bcrypt)
// ======================================
exports.createAdmin = async (req, res) => {
  const { username, password } = req.body;

  try {
    const existingAdmin = await User.findOne({ username });
    if (existingAdmin) {
      return res.status(400).json({ error: "Admin já existe." });
    }

    // Armazena senha em texto puro
    const newAdmin = new User({
      username,
      password,
      role: 'admin'
    });

    await newAdmin.save();
    res.status(201).json({ message: "Admin criado com sucesso (sem bcrypt)." });
  } catch (error) {
    console.error("Erro ao criar admin:", error);
    res.status(500).json({ error: "Erro interno ao criar o admin." });
  }
};
