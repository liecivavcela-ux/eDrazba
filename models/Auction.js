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
    // ===== ZMENA: highestBidder bude ukladať anonymný kód =====
    highestBidder: { 
        type: String 
        // Už nemá default hodnotu 'Nikto', bude null/undefined kým niekto neprihodí
    },
    // ===== ZMENA: bidHistory bude ukladať objekty s bidderId =====
    bidHistory: { 
        type: [{ // Definuje pole objektov s konkrétnou štruktúrou
            bidderId: String, // Anonymný kód záujemcu
            amount: Number,
            timestamp: Date
        }], 
        default: [] // Štartuje ako prázdne pole
    }
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
