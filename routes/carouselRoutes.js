// routes/carouselRoutes.js
const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');
const CarouselModel = require('../models/Carousel');

/** Helper: se a URL não for do mesmo host, devolve via proxy local */
function toSameOrigin(req, url) {
  if (!url) return url;
  try {
    const u = new URL(url, `${req.protocol}://${req.get('host')}`);
    const sameOrigin = `${req.protocol}://${req.get('host')}`;
    if (u.origin === sameOrigin) return u.href;
    return `${sameOrigin}/api/image-proxy?url=${encodeURIComponent(u.href)}`;
  } catch {
    return url; // em caso de string inválida, retorna como veio
  }
}

/* ------------------------------------------------------------------ */
/* POST /api/carousel                                                  */
/* Cria um novo item do carrossel                                     */
/* Body: { imageUrl, fullImageUrl?, alt?, caption? }                  */
/* ------------------------------------------------------------------ */
router.post('/', verifyToken, async (req, res) => {
  try {
    const { imageUrl, fullImageUrl, alt, caption } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'URL da imagem é obrigatória.' });
    }

    // posição final (append)
    const count = await CarouselModel.countDocuments();
    const doc = await CarouselModel.create({
      imageUrl: String(imageUrl).trim(),
      // os campos abaixo são opcionais no schema; se não existirem, Mongo ignora
      fullImageUrl: fullImageUrl ? String(fullImageUrl).trim() : undefined,
      alt: alt ? String(alt).trim() : undefined,
      caption: caption ? String(caption).trim() : undefined,
      position: count
    });

    // já devolve proxificado para o front
    return res.status(201).json({
      _id: doc._id,
      imageUrl: toSameOrigin(req, doc.imageUrl),
      fullImageUrl: toSameOrigin(req, doc.fullImageUrl || doc.imageUrl),
      alt: doc.alt || null,
      caption: doc.caption || null,
      position: doc.position
    });
  } catch (error) {
    console.error('Erro ao adicionar imagem ao carrossel:', error);
    return res.status(500).json({ error: 'Erro interno ao adicionar imagem ao carrossel.' });
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/carousel                                                   */
/* Lista imagens ordenadas.                                            */
/* Query opcional: ?limit=50&offset=0                                  */
/* Sem query -> retorna tudo (com cuidado para catálogos muito grandes)*/
/* ------------------------------------------------------------------ */
router.get('/', async (req, res) => {
  try {
    const limit  = req.query.limit  ? Math.max(0, parseInt(req.query.limit, 10))  : null;
    const offset = req.query.offset ? Math.max(0, parseInt(req.query.offset, 10)) : 0;

    let q = CarouselModel.find().sort({ position: 1 }).lean();
    if (limit !== null) q = q.skip(offset).limit(limit);

    const rows = await q;

    const data = rows.map(d => ({
      _id: d._id,
      imageUrl: toSameOrigin(req, d.imageUrl),
      fullImageUrl: toSameOrigin(req, d.fullImageUrl || d.imageUrl),
      alt: d.alt || null,
      caption: d.caption || null,
      position: d.position ?? null
    }));

    // se paginou, devolve também um total
    if (limit !== null) {
      const total = await CarouselModel.countDocuments();
      return res.json({ total, limit, offset, items: data });
    }
    return res.json(data);
  } catch (error) {
    console.error('Erro ao buscar imagens do carrossel:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar imagens do carrossel.' });
  }
});

/* ------------------------------------------------------------------ */
/* DELETE /api/carousel/:id                                            */
/* Remove item e reindexa posições (0..n-1)                            */
/* ------------------------------------------------------------------ */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const removed = await CarouselModel.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Imagem não encontrada.' });

    // reindexa posições para manter sequência consistente
    const all = await CarouselModel.find().sort({ position: 1 });
    await Promise.all(
      all.map((doc, idx) => {
        if (doc.position !== idx) {
          return CarouselModel.findByIdAndUpdate(doc._id, { position: idx });
        }
        return null;
      })
    );

    return res.status(200).json({ message: 'Imagem removida com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir imagem do carrossel:', error);
    return res.status(500).json({ error: 'Erro interno ao excluir imagem do carrossel.' });
  }
});

/* ------------------------------------------------------------------ */
/* POST /api/carousel/reorder                                          */
/* Body: { order: [id1, id2, ...] }                                    */
/* ------------------------------------------------------------------ */
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
