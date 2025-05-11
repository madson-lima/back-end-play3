// routes/carouselRoutes.js
const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');
const CarouselModel = require('../models/Carousel');

// POST /api/carousel
// Cria um novo item do carrossel a partir de uma URL já válida (vinda do upload para GridFS)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'URL da imagem é obrigatória.' });
    }

    // Posição final (append)
    const count = await CarouselModel.countDocuments();
    const novaImagem = await CarouselModel.create({
      imageUrl,
      position: count
    });

    return res.status(201).json({ imageUrl: novaImagem.imageUrl });
  } catch (error) {
    console.error('Erro ao adicionar imagem ao carrossel:', error);
    return res.status(500).json({ error: 'Erro interno ao adicionar imagem ao carrossel.' });
  }
});

// GET /api/carousel
// Lista todas as imagens ordenadas
router.get('/', async (req, res) => {
  try {
    const imagens = await CarouselModel.find().sort({ position: 1 });
    return res.json(imagens);
  } catch (error) {
    console.error('Erro ao buscar imagens do carrossel:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar imagens do carrossel.' });
  }
});

// DELETE /api/carousel/:id
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    await CarouselModel.findByIdAndDelete(req.params.id);
    return res.status(200).json({ message: 'Imagem removida com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir imagem do carrossel:', error);
    return res.status(500).json({ error: 'Erro interno ao excluir imagem do carrossel.' });
  }
});

// POST /api/carousel/reorder
router.post('/reorder', verifyToken, async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'Formato de ordem inválido.' });
    }
    // Atualiza posição de cada ID
    await Promise.all(order.map((id, idx) =>
      CarouselModel.findByIdAndUpdate(id, { position: idx })
    ));
    return res.status(200).json({ message: 'Ordem atualizada com sucesso.' });
  } catch (error) {
    console.error('Erro ao reordenar carrossel:', error);
    return res.status(500).json({ error: 'Erro interno ao reordenar carrossel.' });
  }
});

module.exports = router;
