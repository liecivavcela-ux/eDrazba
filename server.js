const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const Auction = require('./models/Auction.js'); 

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

app.get('/', (req, res) => {
  res.send('Vitajte na E-Drazba API serveri! Frontend je pripojený.');
});

app.get('/api/drazby', async (req, res) => {
  try {
    const allAuctions = await Auction.find({}).sort({ createdAt: -1 });
    res.status(200).json(allAuctions);
  } catch (error) {
    console.error('Chyba pri načítaní dražieb:', error.message);
    res.status(500).json({ message: 'Nastala chyba na serveri.' });
  }
});

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

// --- ZMENA 4: Prihodenie na aukciu (upravené) ---
app.post('/api/drazby/:id/bid', async (req, res) => {
  try {
    const auctionId = req.params.id;
    
    // ===== ZMENA: Očakávame amount aj bidderId z tela požiadavky =====
    const { amount, bidderId } = req.body; 
    
    // Validácia vstupov
    if (!mongoose.Types.ObjectId.isValid(auctionId)) {
      return res.status(400).json({ message: 'Neplatné ID dražby' });
    }
    if (!bidderId || typeof bidderId !== 'string' || bidderId.trim() === '') {
        return res.status(400).json({ message: 'Chýba alebo je neplatný identifikátor prihadzujúceho (bidderId).' });
    }
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Musíte zadať platnú sumu.' });
    }

    // Nájdenie aukcie
    const auction = await Auction.findById(auctionId);
    if (!auction) {
      return res.status(404).json({ message: 'Dražba nebola nájdená' });
    }

    // Validačná logika (čas, minimálna suma)
    const now = new Date();
    if (now > auction.casSkoncenia) {
      return res.status(400).json({ message: 'Táto aukcia sa už skončila.' });
    }
    if (now < auction.casZaciatku) {
      return res.status(400).json({ message: 'Táto aukcia sa ešte nezačala.' });
    }
    const requiredMinBid = auction.currentPrice + auction.minimalnePrihodenie;
    if (amount < requiredMinBid) {
      return res.status(400).json({ 
        message: `Vaša ponuka je príliš nízka. Musíte ponúknuť aspoň ${requiredMinBid.toLocaleString('sk-SK')} €.` 
      });
    }

    // Vytvorenie záznamu do histórie
    const newBid = {
      bidderId: bidderId, // Použijeme prijaté bidderId
      amount: amount,
      timestamp: new Date()
    };

    // Aktualizácia aukcie
    auction.currentPrice = amount;
    auction.highestBidder = bidderId; // Použijeme prijaté bidderId
    auction.bidHistory.push(newBid); 

    // Uloženie zmien
    const updatedAuction = await auction.save();

    // Odoslanie aktualizovanej aukcie klientovi
    res.status(200).json(updatedAuction);

  } catch (error) {
    console.error('Chyba pri spracovaní prihodenia:', error.message);
    res.status(500).json({ message: 'Nastala chyba na serveri.' });
  }
});
