const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// --- ZJEDNODUŠENÁ SCHÉMA (s predmetom dražby) ---
const auctionSchema = new Schema({
    // Polia zo zjednodušeného formulára
    navrhovatel: { type: String, required: true },
    okres: { type: String, required: true },
    adresa: { type: String, required: true },
    predmetDrazby: { type: String, required: true }, // VRÁTENÉ SPÄŤ!
    najnizsiePodanie: { type: Number, required: true },
    minimalnePrihodenie: { type: Number, required: true },
    mobilNavrhovatela: { type: String, required: true }, 
    casZaciatku: { type: Date, required: true },
    casSkoncenia: { type: Date, required: true },
    
    // Polia pre logiku aukcie (zostávajú)
    currentPrice: { type: Number, default: 0 },
    highestBidder: { type: String },
    bidHistory: { type: [{ bidderId: String, amount: Number, timestamp: Date }], default: [] },
    proxyBids: { type: [{ bidderId: String, maxBid: Number }], default: [] }
}, {
    timestamps: true 
});

auctionSchema.pre('save', function(next) {
    if (this.isNew) { 
        this.currentPrice = typeof this.najnizsiePodanie === 'number' ? this.najnizsiePodanie : 0;
    }
    next(); 
});

const Auction = mongoose.model('Auction', auctionSchema);

module.exports = Auction;
