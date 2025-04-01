const mongoose = require('mongoose');

const CarouselSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  position: { type: Number, default: 0 }
});

module.exports = mongoose.model('Carousel', CarouselSchema);

