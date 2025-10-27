const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const auctionSchema = new Schema({
    // Polia z formulára
    navrhovatel: { type: String, required: true },
    typNehnutelnosti: { type: String, required: true },
    okres: { type: String, required: true },
    adresa: { type: String, required: true },
    znalecnaCena: { type: Number, required: true },
    najnizsiePodanie: { type: Number, required: true },
    minimalnePrihodenie: { type: Number, required: true },
    casZaciatku: { type: Date, required: true },
    casSkoncenia: { type: Date, required: true },
    mobilNavrhovatela: { type: String, required: true },
    predmetDrazby: { type: String, required: true },
    imageUrl: { type: String, required: false },

    // Polia pre logiku aukcie
    currentPrice: { 
        type: Number, 
        default: 0 
    },
    highestBidder: { 
        type: String 
    },
    bidHistory: { 
        type: [{ 
            bidderId: String, 
            amount: Number,
            timestamp: Date
        }], 
        default: [] 
    },
    // ===== NOVÉ POLE PRE AUTOMATICKÉ PRIHADZOVANIE =====
    proxyBids: {
        type: [{
            bidderId: String, // Kto nastavil limit
            maxBid: Number    // Aký je jeho limit
        }],
        default: [] // Štartuje ako prázdne pole
    }
    // ===================================================
}, {
    timestamps: true 
});

auctionSchema.pre('save', function(next) {
    if (this.isNew) { 
        this.currentPrice = this.najnizsiePodanie;
    }
    next(); 
});

const Auction = mongoose.model('Auction', auctionSchema);

module.exports = Auction;
