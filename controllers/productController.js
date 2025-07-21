// controllers/productController.js

const { validationResult } = require('express-validator');
const Product = require('../models/Product');

/**
 * Criar Produto
 * POST /api/products
 */
exports.createProduct = async (req, res) => {
  try {
    const { name, description, price, imageUrl, isNewRelease } = req.body;

    // Validação mínima
    if (!name || !description || !imageUrl) {
      return res
        .status(400)
        .json({ error: 'Nome, descrição e imagem são obrigatórios.' });
    }

    const productPrice = price || '';

    const newProduct = new Product({
      name,
      description,
      price: productPrice,
      imageUrl,
      isNewRelease: !!isNewRelease, // força booleano
    });
    await newProduct.save();

    res
      .status(201)
      .json({ message: 'Produto adicionado com sucesso!', newProduct });
  } catch (error) {
    console.error('Erro ao adicionar produto:', error);
    res.status(500).json({ error: 'Erro ao adicionar produto.' });
  }
};

/**
 * Listar Todos os Produtos (com paginação)
 * GET /api/products?page=1&limit=10
 */
exports.getAllProducts = async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
  const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
  const skip  = (page - 1) * limit;

  // constrói filtro opcional
  const filter = {};
  if (req.query.isNewRelease === 'true')  filter.isNewRelease = true;
  else if (req.query.isNewRelease === 'false') filter.isNewRelease = false;

  try {
    const totalDocs = await Product.countDocuments(filter);
    const docs = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    const totalPages = Math.ceil(totalDocs / limit);

    res.json({ docs, totalDocs, page, totalPages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar produtos!' });
  }
};


/**
 * Obter Produto pelo ID
 * GET /api/products/:id
 */
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado!' });
    }
    res.status(200).json(product);
  } catch (err) {
    console.error('Erro ao buscar produto:', err);
    res.status(500).json({ error: 'Erro ao buscar o produto!' });
  }
};

/**
 * Atualizar Produto
 * PUT /api/products/:id
 */
exports.updateProduct = async (req, res) => {
  // validações de express-validator, se existir
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
        price: price || '',
        imageUrl,
        isNewRelease: !!isNewRelease,
      },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedProduct) {
      return res.status(404).json({ error: 'Produto não encontrado!' });
    }

    res
      .status(200)
      .json({ message: 'Produto atualizado com sucesso!', product: updatedProduct });
  } catch (err) {
    console.error('Erro ao atualizar produto:', err);
    res.status(500).json({ error: 'Erro ao atualizar produto!' });
  }
};

/**
 * Deletar Produto
 * DELETE /api/products/:id
 */
exports.deleteProduct = async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id).lean();
    if (!deletedProduct) {
      return res.status(404).json({ error: 'Produto não encontrado!' });
    }
    res.status(200).json({ message: 'Produto deletado com sucesso!' });
  } catch (err) {
    console.error('Erro ao deletar produto:', err);
    res.status(500).json({ error: 'Erro ao deletar produto!' });
  }
};

/**
 * Listar Novos Lançamentos
 * GET /api/products/releases
 */
exports.getNewReleases = async (req, res) => {
  try {
    const newReleases = await Product.find({ isNewRelease: true })
      .sort({ createdAt: -1 })
      .lean();

    if (!newReleases.length) {
      return res.status(404).json({ error: 'Nenhum lançamento encontrado!' });
    }

    res.status(200).json(newReleases);
  } catch (error) {
    console.error('Erro ao buscar lançamentos:', error);
    res.status(500).json({ error: 'Erro ao buscar os lançamentos.' });
  }
};
