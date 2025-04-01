const { body, validationResult } = require('express-validator');
const Post = require('../models/Post');

// 📌 Criar um novo post
exports.createPost = async (req, res) => {
  // Valida os dados recebidos
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { title, content } = req.body;

  try {
    // Criar novo post
    const newPost = new Post({
      title,
      content
    });

    // Salvar no banco de dados
    await newPost.save();
    res.status(201).json({ message: "Post criado com sucesso!", post: newPost });
  } catch (err) {
    console.error("Erro ao criar post:", err);
    res.status(500).json({ error: "Erro ao criar post!" });
  }
};

// 📌 Listar todos os posts
exports.getAllPosts = async (req, res) => {
  try {
    const posts = await Post.find().sort({ date: -1 }); // Lista em ordem decrescente por data
    res.status(200).json(posts);
  } catch (err) {
    console.error("Erro ao buscar posts:", err);
    res.status(500).json({ error: "Erro ao buscar posts!" });
  }
};

// 📌 Obter um post pelo ID
exports.getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: "Post não encontrado!" });
    }
    res.status(200).json(post);
  } catch (err) {
    console.error("Erro ao buscar post:", err);
    res.status(500).json({ error: "Erro ao buscar o post!" });
  }
};

// 📌 Atualizar um post
exports.updatePost = async (req, res) => {
  // Valida os dados recebidos
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { title, content } = req.body;

  try {
    const updatedPost = await Post.findByIdAndUpdate(
      req.params.id,
      { title, content },
      { new: true }
    );

    if (!updatedPost) {
      return res.status(404).json({ error: "Post não encontrado!" });
    }

    res.status(200).json({ message: "Post atualizado com sucesso!", post: updatedPost });
  } catch (err) {
    console.error("Erro ao atualizar post:", err);
    res.status(500).json({ error: "Erro ao atualizar o post!" });
  }
};

// 📌 Deletar um post
exports.deletePost = async (req, res) => {
  try {
    const deletedPost = await Post.findByIdAndDelete(req.params.id);

    if (!deletedPost) {
      return res.status(404).json({ error: "Post não encontrado!" });
    }

    res.status(200).json({ message: "Post deletado com sucesso!" });
  } catch (err) {
    console.error("Erro ao deletar post:", err);
    res.status(500).json({ error: "Erro ao deletar o post!" });
  }
};
