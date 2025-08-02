// controllers/productController.js

const mongoose = require("mongoose");
const { validationResult } = require("express-validator");
const Product = require("../models/Product");

// ─── Helper para extrair filename de uma URL de imagem ───────────────────────────
function extractFilenameFromUrl(url) {
  if (!url) return null;
  const parts = url.split("/");
  return parts[parts.length - 1];
}

// ─── CRIAR PRODUTO ───────────────────────────────────────────────────────────────
// POST /api/products
exports.createProduct = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, description, price, imageUrl, isNewRelease } = req.body;

    if (typeof imageUrl !== "string" || !imageUrl.trim()) {
      return res.status(400).json({ message: "imageUrl inválida." });
    }

    const newProduct = new Product({
      name: name.trim(),
      description: description.trim(),
      price: price ? String(price) : "",
      imageUrl: imageUrl.trim(),
      isLaunch: isNewRelease === true || isNewRelease === "true"
    });

    await newProduct.save();
    return res.status(201).json(newProduct);
  } catch (error) {
    console.error("Erro em createProduct:", error);
    return res.status(500).json({ message: "Erro interno ao criar produto." });
  }
};

// ─── LISTAR TODOS OS PRODUTOS (com fallback para chamadas sem paginação) ─────────
// GET /api/products
exports.getAllProducts = async (req, res) => {
  try {
    // Se não vier ?page na query, devolve array puro de todos os produtos
    if (req.query.page === undefined) {
      const all = await Product.find().sort({ createdAt: -1 });
      return res.status(200).json(all);
    }

    // Senão, faz paginação normal
    const page  = parseInt(req.query.page,  10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip  = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      Product.countDocuments()
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      products,
      totalPages,
      currentPage: page
    });
  } catch (err) {
    console.error("Erro em getAllProducts:", err);
    return res.status(500).json({ message: "Erro ao buscar produtos." });
  }
};

// ─── LISTAR APENAS LANÇAMENTOS ────────────────────────────────────────────────────
// GET /api/products/new-releases
exports.getNewReleases = async (req, res) => {
  try {
    const lancamentos = await Product.find({ isLaunch: true }).sort({ createdAt: -1 });
    return res.status(200).json(lancamentos);
  } catch (error) {
    console.error("Erro em getNewReleases:", error);
    return res.status(500).json({ message: "Erro ao buscar lançamentos." });
  }
};

// ─── OBTER PRODUTO POR ID ─────────────────────────────────────────────────────────
// GET /api/products/:id
exports.getProductById = async (req, res) => {
  try {
    const produto = await Product.findById(req.params.id);
    if (!produto) {
      return res.status(404).json({ message: "Produto não encontrado." });
    }
    return res.status(200).json(produto);
  } catch (error) {
    console.error("Erro em getProductById:", error);
    return res.status(500).json({ message: "Erro ao buscar produto." });
  }
};

// ─── ATUALIZAR PRODUTO ────────────────────────────────────────────────────────────
// PUT /api/products/:id
exports.updateProduct = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, description, price, imageUrl, isNewRelease } = req.body;
    const produto = await Product.findById(req.params.id);
    if (!produto) {
      return res.status(404).json({ message: "Produto não encontrado." });
    }

    // Se a URL mudou, apaga do GridFS
    if (imageUrl && produto.imageUrl !== imageUrl) {
      const oldFn = extractFilenameFromUrl(produto.imageUrl);
      if (oldFn) {
        const db = mongoose.connection.db;
        const fileDoc = await db.collection("uploads.files").findOne({ filename: oldFn });
        if (fileDoc) {
          const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: "uploads" });
          await bucket.delete(fileDoc._id);
        }
      }
    }

    // Atualiza campos
    produto.name        = name.trim();
    produto.description = description.trim();
    produto.price       = price ? String(price) : "";
    produto.imageUrl    = imageUrl.trim();
    produto.isLaunch    = isNewRelease === true || isNewRelease === "true";

    await produto.save();
    return res.status(200).json(produto);
  } catch (error) {
    console.error("Erro em updateProduct:", error);
    return res.status(500).json({ message: "Erro ao atualizar produto." });
  }
};

// ─── DELETAR PRODUTO ──────────────────────────────────────────────────────────────
// DELETE /api/products/:id
exports.deleteProduct = async (req, res) => {
  try {
    const produto = await Product.findById(req.params.id);
    if (!produto) {
      return res.status(404).json({ message: "Produto não encontrado." });
    }

    // Apaga imagem antiga do GridFS
    const fn = extractFilenameFromUrl(produto.imageUrl);
    if (fn) {
      const db = mongoose.connection.db;
      const fileDoc = await db.collection("uploads.files").findOne({ filename: fn });
      if (fileDoc) {
        const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: "uploads" });
        await bucket.delete(fileDoc._id);
      }
    }

    await Product.deleteOne({ _id: req.params.id });
    return res.status(200).json({ message: "Produto removido com sucesso." });
  } catch (error) {
    console.error("Erro em deleteProduct:", error);
    return res.status(500).json({ message: "Erro ao deletar produto." });
  }
};
