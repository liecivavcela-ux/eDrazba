const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// ===== KROK 1: Importujeme náš NOVÝ model 'Auction' =====
// Cesta teraz vedie do adresára 'models', ktorý sme vytvorili
const Auction = require('./models/Auction.js'); 

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Povolí prístup z tvojho frontendu
app.use(express.json()); // Toto je kľúčové, aby server rozumel JSON dátam z formulára

// --- Pripojenie k MongoDB (zostáva rovnaké) ---
const dbURI = process.env.MONGODB_URI;
if (!dbURI) {
  console.error('CHYBA: MONGODB_URI nebola nájdená v premenných prostredia!');
  process.exit(1);
}

mongoose.connect(dbURI)
  .then(() => {
    console.log('ÚSPECH: Databáza MongoDB je úspešne pripojená.');
    // Server spustíme až po úspešnom pripojení k DB
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

// Testovacia cesta (tú môžeme nechať)
app.get('/', (req, res) => {
  res.send('Vitajte na E-Drazba API serveri! Frontend je pripojený.');
});

// --- ZMENA 1: Načítanie VŠETKÝCH aukcií ---
// Zmenili sme cestu z '/api/auctions' na '/api/drazby', 
// aby sa presne zhodovala s tým, čo volá tvoj 'index.html' (funkcia loadDrazby)
app.get('/api/drazby', async (req, res) => {
  try {
    // Nájdi všetky dokumenty v kolekcii 'Auction'
    // a zoraď ich od najnovšie vytvorených (nech sú nové aukcie hore)
    const allAuctions = await Auction.find({}).sort({ createdAt: -1 });
    
    // Pošli ich naspäť klientovi (frontendu) ako JSON
    res.status(200).json(allAuctions);

  } catch (error) {
    console.error('Chyba pri načítaní dražieb:', error.message);
    res.status(500).json({ message: 'Nastala chyba na serveri.' });
  }
});

// --- ZMENA 2: Vytvorenie NOVEJ aukcie ---
// Toto je úplne nový endpoint, ktorý tvoj formulár volá
// Prijíma 'POST' požiadavky na adresu '/api/drazby'
app.post('/api/drazby', async (req, res) => {
  try {
    // Dáta z formulára nám prídu v 'req.body' (vďaka app.use(express.json()))
    console.log('Server prijal dáta na vytvorenie dražby:', req.body);
    
    // Vytvoríme novú inštanciu modelu 'Auction' s dátami z formulára
    const novaDrazba = new Auction(req.body);
    
    // Uložíme ju do databázy
    // (tu sa automaticky spustí aj ten náš 'pre-save' hook z modelu,
    // ktorý nastaví 'currentPrice' = 'najnizsiePodanie')
    const ulozenaDrazba = await novaDrazba.save();
    
    // Ak sa uloženie podarilo, pošleme klientovi (frontendu) naspäť uložený objekt
    // (je to dobrá prax, klient tak dostane napr. _id a 'createdAt' čas)
    res.status(201).json(ulozenaDrazba);

  } catch (error) {
    // Ak nastane chyba (napr. chýbajú povinné polia, ktoré sme v schéme označili ako 'required: true')
    console.error('Chyba pri ukladaní novej dražby:', error.message);
    // Pošleme chybu 400 (Bad Request) aj s dôvodom, prečo to zlyhalo
    res.status(400).json({ message: 'Chyba pri ukladaní dát: ' + error.message });
  }
});
