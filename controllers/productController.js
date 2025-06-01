const mongoose = require("mongoose");
const { validationResult } = require("express-validator");
const Product = require("../models/Product");

// ─── Função auxiliar para extrair filename de uma URL de imagem ───────────────────
function extractFilenameFromUrl(url) {
  // Exemplo: "https://host/api/files/upload_162738123123_arquivo.jpg"
  // Queremos "upload_162738123123_arquivo.jpg"
  if (!url) return null;
  const parts = url.split("/");
  return parts[parts.length - 1];
}

// ─── CRIAR PRODUTO ────────────────────────────────────────────────────────────────
// POST /api/products
// Body: { name, description, price, imageUrl, isLaunch }
exports.createProduct = async (req, res) => {
  // 1) Verifica erros gerados pelo express-validator
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Retorna o primeiro erro encontrado
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, description, price, imageUrl, isLaunch } = req.body;

    // Garante que imagem seja uma URL não-vazia
    if (typeof imageUrl !== "string" || imageUrl.trim() === "") {
      return res.status(400).json({ message: "imageUrl inválida." });
    }

    const newProduct = new Product({
      name: name.trim(),
      description: description.trim(),
      price: price ? String(price) : "",
      imageUrl: imageUrl.trim(),
      isLaunch: isLaunch === true || isLaunch === "true"
    });

    await newProduct.save();
    return res.status(201).json(newProduct);
  } catch (error) {
    console.error("Erro em createProduct:", error);
    return res.status(500).json({ message: "Erro interno ao criar produto." });
  }
};

// ─── LISTAR TODOS OS PRODUTOS ─────────────────────────────────────────────────────
// GET /api/products
exports.getAllProducts = async (req, res) => {
  try {
    const produtos = await Product.find().sort({ createdAt: -1 });
    return res.status(200).json(produtos);
  } catch (error) {
    console.error("Erro em getAllProducts:", error);
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
    const { id } = req.params;
    // Como a rota já validou ObjectId, não precisamos validar aqui novamente
    const produto = await Product.findById(id);
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
// Body: { name, description, price, imageUrl, isLaunch }
exports.updateProduct = async (req, res) => {
  // Validação do body
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id } = req.params;
    const { name, description, price, imageUrl, isLaunch } = req.body;

    // Verifica existência do produto
    const produtoExistente = await Product.findById(id);
    if (!produtoExistente) {
      return res.status(404).json({ message: "Produto não encontrado." });
    }

    // Se a imagem foi alterada (URL diferente), apagamos o arquivo antigo do GridFS
    if (imageUrl && produtoExistente.imageUrl !== imageUrl) {
      const oldFilename = extractFilenameFromUrl(produtoExistente.imageUrl);
      if (oldFilename) {
        const db = mongoose.connection.db;
        const filesColl = db.collection("uploads.files");
        const fileDoc = await filesColl.findOne({ filename: oldFilename });
        if (fileDoc) {
          const gfsBucket = new mongoose.mongo.GridFSBucket(db, { bucketName: "uploads" });
          await gfsBucket.delete(fileDoc._id);
        }
      }
    }

    // Atualiza campos
    produtoExistente.name = name.trim();
    produtoExistente.description = description.trim();
    produtoExistente.price = price ? String(price) : "";
    produtoExistente.imageUrl = imageUrl.trim();
    produtoExistente.isLaunch = isLaunch === true || isLaunch === "true";

    await produtoExistente.save();
    return res.status(200).json(produtoExistente);
  } catch (error) {
    console.error("Erro em updateProduct:", error);
    return res.status(500).json({ message: "Erro ao atualizar produto." });
  }
};

// ─── DELETAR PRODUTO ──────────────────────────────────────────────────────────────
// DELETE /api/products/:id
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const produto = await Product.findById(id);
    if (!produto) {
      return res.status(404).json({ message: "Produto não encontrado." });
    }

    // Apaga o arquivo de imagem do GridFS
    const filename = extractFilenameFromUrl(produto.imageUrl);
    if (filename) {
      const db = mongoose.connection.db;
      const filesColl = db.collection("uploads.files");
      const fileDoc = await filesColl.findOne({ filename: filename });
      if (fileDoc) {
        const gfsBucket = new mongoose.mongo.GridFSBucket(db, { bucketName: "uploads" });
        await gfsBucket.delete(fileDoc._id);
      }
    }

    // Remove o documento do produto
    await Product.deleteOne({ _id: id });
    return res.status(200).json({ message: "Produto removido com sucesso." });
  } catch (error) {
    console.error("Erro em deleteProduct:", error);
    return res.status(500).json({ message: "Erro ao deletar produto." });
  }
};
