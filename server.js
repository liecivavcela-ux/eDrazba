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

// --- Pripojenie k MongoDB ---
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

// --- 1. Testovacia cesta ---
app.get('/', (req, res) => {
  res.send('Vitajte na E-Drazba API serveri! Frontend je pripojený.');
});

// --- 2. Načítanie VŠETKÝCH aukcií ---
app.get('/api/drazby', async (req, res) => {
  try {
    const allAuctions = await Auction.find({}).sort({ createdAt: -1 });
    res.status(200).json(allAuctions);
  } catch (error) {
    console.error('Chyba pri načítaní dražieb:', error.message);
    res.status(500).json({ message: 'Nastala chyba na serveri.' });
  }
});

// --- 3. Vytvorenie NOVEJ aukcie ---
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

// --- 4. Načítanie JEDNEJ dražby podľa jej ID ---
app.get('/api/drazby/:id', async (req, res) => {
  try {
    const auctionId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(auctionId)) {
        return res.status(404).json({ message: 'Neplatné ID dražby' });
    }
    const auction = await Auction.findById(auctionId);
    if (!auction) {
      return res.status(404).json({ message: 'Dražba nebola nájdená' });
    }
    res.status(200).json(auction);
  } catch (error) {
    console.error('Chyba pri načítaní detailu dražby:', error.message);
    res.status(500).json({ message: 'Nastala chyba na serveri.' });
  }
});

// ===== NOVÝ KÓD ZAČÍNA TU =====

// --- ZMENA 4: Prihodenie na aukciu ---
// Tento endpoint prijme 'POST' požiadavku na /api/drazby/NEJAKE_ID/bid
app.post('/api/drazby/:id/bid', async (req, res) => {
  try {
    // 1. Získame ID dražby z URL a sumu (amount) z tela požiadavky
    const auctionId = req.params.id;
    const { amount } = req.body; // Očakávame, že frontend pošle JSON objekt: { "amount": 150000 }
    
    // Zatiaľ nemáme prihlásenie, tak si meno prihadzujúceho vymyslíme:
    const bidderName = "Anonymný Záujemca"; 

    // 2. Skontrolujeme, či je ID platné
    if (!mongoose.Types.ObjectId.isValid(auctionId)) {
      return res.status(404).json({ message: 'Neplatné ID dražby' });
    }

    // 3. NÁJDEME dražbu v databáze
    const auction = await Auction.findById(auctionId);
    if (!auction) {
      return res.status(404).json({ message: 'Dražba nebola nájdená' });
    }

    // 4. --- VALIDAČNÁ LOGIKA (Veľmi dôležité!) ---
    
    // a) Skontrolujeme, či je suma platné číslo
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Musíte zadať platnú sumu.' });
    }

    // b) Skontrolujeme, či aukcia ešte beží (či už neskončila)
    const now = new Date();
    if (now > auction.casSkoncenia) {
      return res.status(400).json({ message: 'Táto aukcia sa už skončila.' });
    }
    // c) Skontrolujeme, či sa aukcia už začala
    if (now < auction.casZaciatku) {
      return res.status(400).json({ message: 'Táto aukcia sa ešte nezačala.' });
    }

    // d) Skontrolujeme, či je ponuka dostatočne vysoká
    // Musí byť aspoň (aktuálna cena + minimálne prihodenie)
    const requiredMinBid = auction.currentPrice + auction.minimalnePrihodenie;
    if (amount < requiredMinBid) {
      return res.status(400).json({ 
        message: `Vaša ponuka je príliš nízka. Musíte ponúknuť aspoň ${requiredMinBid.toLocaleString('sk-SK')} €.` 
      });
    }

    // 5. --- VŠETKO JE V PORIADKU: Aktualizujeme dražbu ---
    
    // Vytvoríme nový záznam do histórie
    const newBid = {
      bidder: bidderName,
      amount: amount,
      timestamp: new Date()
    };

    // Aktualizujeme polia v dokumente
    auction.currentPrice = amount;
    auction.highestBidder = bidderName;
    auction.bidHistory.push(newBid); // Pridáme nový záznam do poľa

    // 6. ULOŽÍME zmeny do databázy
    const updatedAuction = await auction.save();

    // 7. Pošleme klientovi naspäť aktualizovanú dražbu
    // (aby frontend vedel zobraziť novú cenu a históriu)
    res.status(200).json(updatedAuction);

  } catch (error) {
    console.error('Chyba pri spracovaní prihodenia:', error.message);
    res.status(500).json({ message: 'Nastala chyba na serveri.' });
  }
});

// ===== NOVÝ KÓD KONČÍ TU =====
