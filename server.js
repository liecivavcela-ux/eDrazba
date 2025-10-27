const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Importujeme náš model 'Auction'
const Auction = require('./models/Auction.js'); 

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors()); 
app.use(express.json()); 

// --- Pripojenie k MongoDB (zostáva rovnaké) ---
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

// -----------------------------------------------------------------
// API Endpoints (Cesty)
// -----------------------------------------------------------------

// Testovacia cesta
app.get('/', (req, res) => {
  res.send('Vitajte na E-Drazba API serveri! Frontend je pripojený.');
});

// --- ZMENA 1: Načítanie VŠETKÝCH aukcií ---
app.get('/api/drazby', async (req, res) => {
  try {
    const allAuctions = await Auction.find({}).sort({ createdAt: -1 });
    res.status(200).json(allAuctions);
  } catch (error) {
    console.error('Chyba pri načítaní dražieb:', error.message);
    res.status(500).json({ message: 'Nastala chyba na serveri.' });
  }
});

// --- ZMENA 2: Vytvorenie NOVEJ aukcie ---
app.post('/api/drazby', async (req, res) => {
  try {
    console.log('Server prijal dáta na vytvorenie dražby:', req.body);
    const novaDrazba = new Auction(req.body);
    const ulozenaDrazba = await novaDrazba.save();
    res.status(201).json(ulozenaDrazba);
  } catch (error) {
    console.error('Chyba pri ukladaní novej dražby:', error.message);
    res.status(400).json({ message: 'Chyba pri ukladaní dát: ' + error.message });
  }
});

// ===== NOVÝ KÓD ZAČÍNA TU =====

// --- ZMENA 3: Načítanie JEDNEJ dražby podľa jej ID ---
// Toto je nový endpoint, ktorý bude frontend volať, keď klikneš na detail
// :id je "parameter" - znamená to, že čokoľvek, čo príde po /api/drazby/,
// sa uloží do premennej req.params.id
app.get('/api/drazby/:id', async (req, res) => {
  try {
    // 1. Získame ID z URL adresy
    const auctionId = req.params.id;

    // 2. Skontrolujeme, či je to platné MongoDB ID (ochrana pred chybou)
    if (!mongoose.Types.ObjectId.isValid(auctionId)) {
        return res.status(404).json({ message: 'Neplatné ID dražby' });
    }

    // 3. Nájdeme dražbu v databáze podľa tohto ID
    const auction = await Auction.findById(auctionId);

    // 4. Ak sa dražba s takým ID nenašla
    if (!auction) {
      return res.status(404).json({ message: 'Dražba nebola nájdená' });
    }

    // 5. Ak sme ju našli, pošleme ju klientovi
    res.status(200).json(auction);

  } catch (error) {
    // 6. Ak nastala všeobecná chyba servera
    console.error('Chyba pri načítaní detailu dražby:', error.message);
    res.status(500).json({ message: 'Nastala chyba na serveri.' });
  }
});

// ===== NOVÝ KÓD KONČÍ TU =====
