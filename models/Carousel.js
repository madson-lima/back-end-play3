const mongoose = require('mongoose');

const CarouselSchema = new mongoose.Schema({
  imageUrl: {
    type: String,
    required: true,
    trim: true
  },
  fullImageUrl: {
    type: String,
    trim: true
  },
  alt: {
    type: String,
    trim: true
  },
  caption: {
    type: String,
    trim: true
  },
  position: {
    type: Number,
    required: true,
    default: 0,
    index: true   // ⚡ acelera ordenações
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  versionKey: false
});

// Garante que sempre haja um índice eficiente em position
CarouselSchema.index({ position: 1 });

module.exports = mongoose.model('Carousel', CarouselSchema);
