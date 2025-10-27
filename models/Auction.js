const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Toto je nová schéma, ktorá PRESNE zodpovedá poliam v tvojom formulári
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

    // ===== TOTO JE NOVÉ POLE PRE OBRÁZOK =====
    imageUrl: { 
        type: String, 
        required: false // Obrázok nebude povinný
    },
    // ==========================================

    // Tieto polia si pridáme pre logiku aukcie
    // (formulár ich neposiela, doplnia sa samé pri vytvorení)
    currentPrice: { 
        type: Number, 
        default: 0 
    },
    highestBidder: { 
        type: String, 
        default: 'Nikto' 
    },
    bidHistory: { 
        type: Array, 
        default: [] 
    }
}, {
    // Automaticky pridá polia 'createdAt' a 'updatedAt' (kedy bol záznam vytvorený/upravený)
    timestamps: true 
});

// Toto je "hook", ktorý sa spustí VŽDY pred uložením NOVÉHO dokumentu
// Zabezpečí, že 'currentPrice' (aktuálna cena) sa automaticky nastaví
// na hodnotu 'najnizsiePodanie' (najnižšie podanie) pri vytváraní novej dražby.
auctionSchema.pre('save', function(next) {
    if (this.isNew) { // Spustí sa len pri vytváraní (this.isNew), nie pri úprave
        this.currentPrice = this.najnizsiePodanie;
    }
    next(); // Pokračuj v procese ukladania
});

// Vytvoríme model z našej schémy
const Auction = mongoose.model('Auction', auctionSchema);

// Exportujeme model, aby ho mohol 'server.js' používať
module.exports = Auction;
