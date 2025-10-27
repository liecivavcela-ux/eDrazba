const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// --- ZJEDNODUŠENÁ SCHÉMA ---
const auctionSchema = new Schema({
    // Polia zo zjednodušeného formulára
    navrhovatel: { type: String, required: true },
    okres: { type: String, required: true },
    adresa: { type: String, required: true },
    najnizsiePodanie: { type: Number, required: true },
    minimalnePrihodenie: { type: Number, required: true },
    mobilNavrhovatela: { type: String, required: true }, // Zostáva pre kontakt
    casZaciatku: { type: Date, required: true },
    casSkoncenia: { type: Date, required: true },
    
    // Polia pre logiku aukcie (zostávajú)
    currentPrice: { 
        type: Number, 
        default: 0 
    },
    highestBidder: { 
        type: String // Anonymný kód záujemcu
    },
    bidHistory: { 
        type: [{ 
            bidderId: String, 
            amount: Number,
            timestamp: Date
        }], 
        default: [] 
    },
    // Pole pre automatické prihadzovanie (zatiaľ necháme, využijeme neskôr)
    proxyBids: {
        type: [{ bidderId: String, maxBid: Number }],
        default: [] 
    }
}, {
    timestamps: true // Automaticky pridá createdAt a updatedAt
});

// Hook na nastavenie currentPrice = najnizsiePodanie pri vytvorení
auctionSchema.pre('save', function(next) {
    if (this.isNew) { 
        // Overíme, či najnizsiePodanie je platné číslo, inak dáme 0
        this.currentPrice = typeof this.najnizsiePodanie === 'number' ? this.najnizsiePodanie : 0;
    }
    next(); 
});

const Auction = mongoose.model('Auction', auctionSchema);

module.exports = Auction;
