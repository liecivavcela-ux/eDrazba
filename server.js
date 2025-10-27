const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const Auction = require('./models/Auction.js'); // Náš model zostáva rovnaký

const app = express();
const port = process.env.PORT || 3000;

app.use(cors()); 
app.use(express.json()); 

const dbURI = process.env.MONGODB_URI;
if (!dbURI) {
  console.error('CHYBA: MONGODB_URI nebola nájdená v premenných prostredia!');
  process.exit(1);
}

mongoose.connect(dbURI)
  .then(() => {
    console.log('ÚSPECH: Databáza MongoDB je úspešne pripojená.');
    app.listen(port, () => {
      console.log(`Server bol spustený a beží na porte ${port}`);
    });
  })
  .catch(err => {
    console.error('ZLYHANIE: Nepodarilo sa pripojiť k MongoDB.');
    console.error(err.message);
    process.exit(1);
  });

// --- API Endpoints ---

// 1. Test
app.get('/', (req, res) => { res.send('Vitajte na E-Drazba API serveri! (Jedna stránka)'); });

// 2. GET Všetky aukcie
app.get('/api/drazby', async (req, res) => { /* ... zostáva rovnaký ... */ });

// 3. POST Nová aukcia
app.post('/api/drazby', async (req, res) => { /* ... zostáva rovnaký ... */ });

// 4. GET Detail jednej aukcie
app.get('/api/drazby/:id', async (req, res) => { /* ... zostáva rovnaký ... */ });

// 5. POST Nastavenie Proxy Bidu
app.post('/api/drazby/:id/setproxy', async (req, res) => { /* ... zostáva rovnaký ... */ });

// 6. POST Manuálne Prihodenie (s logikou automatu)
app.post('/api/drazby/:id/bid', async (req, res) => { /* ... zostáva rovnaký ... */ });


// ===== NOVÝ KÓD ZAČÍNA TU =====

// --- Endpoint 7: Mazanie aukcie ---
// Použijeme metódu DELETE na adresu /api/drazby/:id
app.delete('/api/drazby/:id', async (req, res) => {
    try {
        const auctionId = req.params.id;

        // Validácia ID
        if (!mongoose.Types.ObjectId.isValid(auctionId)) {
            return res.status(400).json({ message: 'Neplatné ID dražby' });
        }

        console.log(`Požiadavka na zmazanie aukcie ID: ${auctionId}`);

        // Nájdenie a zmazanie aukcie podľa ID
        const result = await Auction.findByIdAndDelete(auctionId);

        // Ak sa aukcia s daným ID nenašla (už bola zmazaná?)
        if (!result) {
            console.warn(`Aukcia ID ${auctionId} nebola nájdená na zmazanie.`);
            return res.status(404).json({ message: 'Dražba nebola nájdená' });
        }

        console.log(`Aukcia ID ${auctionId} bola úspešne zmazaná.`);
        // Pošleme odpoveď 200 OK s potvrdením
        res.status(200).json({ message: 'Dražba bola úspešne zmazaná.' });

    } catch (error) {
        console.error('Chyba pri mazaní aukcie:', error.message);
        res.status(500).json({ message: 'Nastala chyba na serveri pri mazaní.' });
    }
});

// ===== NOVÝ KÓD KONČÍ TU =====


// --- Pomocná funkcia pre Proxy Bidding ---
async function runProxyBidding(auction) { /* ... zostáva rovnaká ... */ }

// --- Implementácie ostatných endpointov (zostávajú rovnaké) ---
// (Tu by bol kód pre GET /, GET /api/drazby, POST /api/drazby, GET /api/drazby/:id, POST /api/drazby/:id/setproxy, POST /api/drazby/:id/bid)
// Pre prehľadnosť ich sem znova nekopírujem, ale v tvojom súbore server.js musia byť všetky.
// Jednoducho skopíruj celý kód z tejto odpovede.
// ... (kód pre ostatné endpointy a funkciu runProxyBidding) ...
