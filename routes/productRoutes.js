const express = require("express");
const { body } = require("express-validator");
const mongoose = require("mongoose");
const productController = require("../controllers/productController");
const verifyToken = require("../middlewares/verifyToken");

const router = express.Router();

// POST /api/products
router.post(
  "/",
  verifyToken,
  [
    body("name").notEmpty().withMessage("O nome do produto é obrigatório"),
    body("description").notEmpty().withMessage("A descrição é obrigatória"),
    body("price").optional().isNumeric().withMessage("O preço deve ser um número"),
    body("imageUrl").notEmpty().withMessage("A URL da imagem é obrigatória")
  ],
  productController.createProduct
);

// GET /api/products/new-releases
router.get("/new-releases", productController.getNewReleases);

// GET /api/products?page=1&limit=20
router.get("/", productController.getAllProducts);

// GET /api/products/:id
router.get(
  "/:id",
  (req, res, next) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "ID inválido!" });
    }
    next();
  },
  productController.getProductById
);

// PUT /api/products/:id
router.put(
  "/:id",
  verifyToken,
  [
    body("name").notEmpty().withMessage("O nome do produto é obrigatório"),
    body("description").notEmpty().withMessage("A descrição é obrigatória"),
    body("price").optional().isNumeric().withMessage("O preço deve ser um número"),
    body("imageUrl").notEmpty().withMessage("A URL da imagem é obrigatória")
  ],
  productController.updateProduct
);

// DELETE /api/products/:id
router.delete("/:id", verifyToken, productController.deleteProduct);

module.exports = router;
