// --- KROK 1: Importujeme pomocníkov ---
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// --- KROK 2: Inicializácia aplikácie ---
const app = express();
const PORT = process.env.PORT || 3000; // Render nastaví PORT automaticky

// --- KROK 3: Nastavenie "Middleware" ---
app.use(cors());
app.use(express.json()); // Umožní nám čítať JSON z tela požiadavky

// --- KROK 4: Pripojenie k MongoDB Databáze ---
// !! DÔLEŽITÉ: Neskôr sem vložíš svoj NOVÝ Connection String z Atlasu pre Projekt 2 !!
// Uložíme ho ako premennú prostredia na Renderi
const DB_CONNECTION_STRING = process.env.DB_CONNECTION_STRING;

async function connectToDb() {
    try {
        await mongoose.connect(DB_CONNECTION_STRING);
        console.log("ÚSPECH: Podarilo sa pripojiť k novej MongoDB Atlas databáze!");
    } catch (error) {
        console.error("CHYBA: Nepodarilo sa pripojiť k MongoDB!", error);
        process.exit(1); // Ukončí aplikáciu, ak sa DB nepripojí
    }
}

// --- KROK 5: Definícia "Schémy" (Ako vyzerá naša Dražba) ---
// Presne podľa tvojich požiadaviek
const drazbaSchema = new mongoose.Schema({
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
    
    // Polia pre Fázu 2 a ďalšie (zatiaľ ich nebudeme používať)
    status: { type: String, default: 'pripravovana' }, // napr. pripravovana, prebieha, ukoncena
    aktualnaCena: { type: Number, default: 0 },
    vitaz: { type: String, default: null }
});

const Drazba = mongoose.model('Drazba', drazbaSchema); // Vytvorí kolekciu 'drazby'

// --- KROK 6: Definícia API Adries (Endpointy) ---

/**
 * [POST] /api/drazby
 * Vytvorí novú dražbu (pre Navrhovateľa).
 */
app.post('/api/drazby', async (req, res) => {
    console.log("Požiadavka: Navrhovateľ pridáva novú dražbu...");
    try {
        const dataDrazby = req.body;
        
        // Jednoduchá validácia (mongoose to skontroluje aj cez 'required')
        if (!dataDrazby.predmetDrazby || !dataDrazby.najnizsiePodanie) {
             return res.status(400).json({ message: 'Chýbajú povinné údaje.' });
        }
        
        // Nastavíme aktuálnu cenu na najnižšie podanie na začiatku
        dataDrazby.aktualnaCena = dataDrazby.najnizsiePodanie;
        
        const novaDrazba = new Drazba(dataDrazby);
        const ulozenaDrazba = await novaDrazba.save();
        
        console.log(`ÚSPECH: Dražba ID:${ulozenaDrazba._id} bola uložená do DB.`);
        res.status(201).json(ulozenaDrazba);

    } catch (error) {
        console.error("CHYBA DB pri ukladaní novej dražby:", error);
        res.status(500).json({ message: "Chyba na strane servera.", error: error.message });
    }
});

/**
 * [GET] /api/drazby
 * Získa zoznam všetkých dražieb (pre Záujemcu).
 */
app.get('/api/drazby', async (req, res) => {
     console.log("Požiadavka: Záujemca chce vidieť všetky dražby.");
     try {
         // Zatiaľ nájdeme všetky, neskôr môžeme filtrovať len 'pripravovane' a 'prebiehajuce'
        const vsetkyDrazby = await Drazba.find({}).sort({ casZaciatku: 1 }); // Zoradíme podľa času začiatku
        res.json(vsetkyDrazby);
     } catch (error) {
         console.error("CHYBA DB pri hľadaní všetkých dražieb:", error);
         res.status(500).json({ message: "Chyba na strane servera." });
     }
});


// --- KROK 7: Spustenie servera ---
console.log("Pripájam sa k MongoDB Atlas...");
connectToDb().then(() => {
    app.listen(PORT, () => {
        console.log("-----------------------------------------");
        console.log(`Backend server "E-Dražba" beží!`);
        console.log(`Čakám na požiadavky na porte ${PORT}`);
        console.log("-----------------------------------------");
    });
});
