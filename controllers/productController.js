const { body, validationResult } = require('express-validator');
const Product = require('../models/Product'); // Modelo do Produto

// 📌 Criar Produto
exports.createProduct = async (req, res) => {
  try {
    const { name, description, price, imageUrl } = req.body;

    if (!name || !description || !imageUrl) {
      return res.status(400).json({ error: 'Nome, descrição e imagem são obrigatórios.' });
    }

    // ✅ Se o preço não for enviado, definir como string vazia
    const productPrice = price || "";

    const newProduct = new Product({ name, description, price: productPrice, imageUrl });
    await newProduct.save();

    res.status(201).json({ message: 'Produto adicionado com sucesso!', newProduct });
  } catch (error) {
    console.error('Erro ao adicionar produto:', error);
    res.status(500).json({ error: 'Erro ao adicionar produto.' });
  }
};

// 📌 Listar Todos os Produtos
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json(products);
  } catch (err) {
    console.error("Erro ao buscar produtos:", err);
    res.status(500).json({ error: "Erro ao buscar produtos!" });
  }
};

// 📌 Obter Produto pelo ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Produto não encontrado!" });
    }
    res.status(200).json(product);
  } catch (err) {
    console.error("Erro ao buscar produto:", err);
    res.status(500).json({ error: "Erro ao buscar o produto!" });
  }
};

// 📌 Atualizar Produto
exports.updateProduct = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, description, price, imageUrl, isNewRelease } = req.body;

  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { 
        name, 
        description, 
        price: price || "", // ✅ Definir preço vazio se não for informado
        imageUrl, 
        isNewRelease 
      },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ error: "Produto não encontrado!" });
    }

    res.status(200).json({ message: "Produto atualizado com sucesso!", product: updatedProduct });
  } catch (err) {
    console.error("Erro ao atualizar produto:", err);
    res.status(500).json({ error: "Erro ao atualizar produto!" });
  }
};

// 📌 Deletar Produto
exports.deleteProduct = async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);

    if (!deletedProduct) {
      return res.status(404).json({ error: "Produto não encontrado!" });
    }

    res.status(200).json({ message: "Produto deletado com sucesso!" });
  } catch (err) {
    console.error("Erro ao deletar produto:", err);
    res.status(500).json({ error: "Erro ao deletar produto!" });
  }
};

// 📌 Listar Novos Lançamentos
exports.getNewReleases = async (req, res) => {
  try {
    // Buscar produtos marcados como lançamentos
    const newReleases = await Product.find({ isNewRelease: true });

    if (!newReleases || newReleases.length === 0) {
      return res.status(404).json({ error: "Nenhum lançamento encontrado!" });
    }

    res.status(200).json(newReleases);
  } catch (error) {
    console.error("Erro ao buscar lançamentos:", error);
    res.status(500).json({ error: "Erro ao buscar os lançamentos." });
  }
};
