const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Importujeme náš zjednodušený model
const Auction = require('./models/Auction.js');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const dbURI = process.env.MONGODB_URI;
if (!dbURI) { console.error('CHYBA: MONGODB_URI!'); process.exit(1); }

mongoose.connect(dbURI)
  .then(() => {
    console.log('DB pripojená.');
    app.listen(port, () => console.log(`Server beží na porte ${port}`));
  })
  .catch(err => { console.error('DB chyba pripojenia:', err.message); process.exit(1); });

// --- API Endpoints ---

// 1. Test
app.get('/', (req, res) => { res.send('Vitajte na E-Drazba API serveri! (Super Zjednodušená verzia)'); });

// 2. GET Všetky aukcie
app.get('/api/drazby', async (req, res) => {
    try {
        const allAuctions = await Auction.find({}).sort({ createdAt: -1 });
        res.status(200).json(allAuctions);
    } catch (error) {
        console.error('Chyba GET /api/drazby:', error.message);
        res.status(500).json({ message: 'Serverová chyba.' });
    }
});

// 3. POST Nová aukcia (Prispôsobené zjednodušenému modelu)
app.post('/api/drazby', async (req, res) => {
  try {
    console.log('Prijaté dáta pre novú dražbu:', req.body);
    const { navrhovatel, okres, adresa, predmetDrazby, najnizsiePodanie, minimalnePrihodenie, mobilNavrhovatela, casZaciatku, casSkoncenia } = req.body;
    const auctionData = { navrhovatel, okres, adresa, predmetDrazby, najnizsiePodanie, minimalnePrihodenie, mobilNavrhovatela, casZaciatku, casSkoncenia };
    const novaDrazba = new Auction(auctionData);
    const ulozenaDrazba = await novaDrazba.save();
    console.log('Nová dražba uložená:', ulozenaDrazba._id);
    res.status(201).json(ulozenaDrazba);
  } catch (error) {
    console.error('Chyba pri ukladaní novej dražby:', error.message);
    res.status(400).json({ message: 'Chyba pri ukladaní dát: ' + error.message });
  }
});

// 4. GET Detail jednej aukcie
app.get('/api/drazby/:id', async (req, res) => {
  try {
    const auctionId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(auctionId)) return res.status(400).json({ message: 'Neplatné ID' });
    const auction = await Auction.findById(auctionId);
    if (!auction) return res.status(404).json({ message: 'Nenájdená' });
    res.status(200).json(auction);
  } catch (error) {
    console.error('Chyba GET /api/drazby/:id:', error.message);
    res.status(500).json({ message: 'Serverová chyba.' });
  }
});

// 5. POST Nastavenie Proxy Bidu
app.post('/api/drazby/:id/setproxy', async (req, res) => {
    try {
        const auctionId = req.params.id; const { bidderId, maxBid } = req.body;
        if (!mongoose.Types.ObjectId.isValid(auctionId)) return res.status(400).json({ message: 'Neplatné ID' });
        if (!bidderId || maxBid === undefined || maxBid === null || isNaN(maxBid) || maxBid <= 0) return res.status(400).json({ message: 'Neplatné dáta' });
        const auction = await Auction.findById(auctionId);
        if (!auction) return res.status(404).json({ message: 'Nenájdená' });
        if (maxBid < auction.najnizsiePodanie) return res.status(400).json({ message: `Limit musí byť aspoň ${auction.najnizsiePodanie} €.` });
        const idx = auction.proxyBids.findIndex(p => p.bidderId === bidderId);
        if (idx > -1) { auction.proxyBids[idx].maxBid = maxBid; } else { auction.proxyBids.push({ bidderId, maxBid }); }
        await runProxyBidding(auction);
        const updatedAuction = await auction.save();
        res.status(200).json({ message: 'Max ponuka nastavená.', auction: updatedAuction });
    } catch (error) { console.error('Chyba setproxy:', error.message); res.status(500).json({ message: 'Serverová chyba.' }); }
});

// 6. POST Manuálne Prihodenie
app.post('/api/drazby/:id/bid', async (req, res) => {
  try {
    const auctionId = req.params.id; const { amount, bidderId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(auctionId)) return res.status(400).json({ message: 'Neplatné ID' });
    if (!bidderId || !amount || isNaN(amount) || amount <= 0) return res.status(400).json({ message: 'Neplatné dáta' });
    const auction = await Auction.findById(auctionId);
    if (!auction) return res.status(404).json({ message: 'Nenájdená' });
    const now = new Date();
    if (now > auction.casSkoncenia) return res.status(400).json({ message: 'Aukcia skončila.' });
    if (now < auction.casZaciatku) return res.status(400).json({ message: 'Aukcia nezačala.' });
    const bidderProxy = auction.proxyBids.find(p => p.bidderId === bidderId);
    if (bidderProxy && amount > bidderProxy.maxBid) return res.status(400).json({ message: `Prekračujete limit ${bidderProxy.maxBid} €.` });
    const requiredMinBid = (auction.currentPrice || 0) + (auction.minimalnePrihodenie || 1);
    if (amount < requiredMinBid) return res.status(400).json({ message: `Minimum je ${requiredMinBid} €.` });
    if (amount === auction.currentPrice && auction.highestBidder !== bidderId) return res.status(400).json({ message: `Musíte ponúknuť viac.` });
    
    console.log(`Manuálny bid: ${bidderId} -> ${amount}`);
    const newManualBid = { bidderId: bidderId, amount: amount, timestamp: now };
    if (amount > auction.currentPrice || auction.bidHistory.length === 0) { auction.currentPrice = amount; auction.highestBidder = bidderId; }
    auction.bidHistory.push(newManualBid);
    await runProxyBidding(auction);
    const finalAuctionState = await auction.save();
    res.status(200).json(finalAuctionState);
  } catch (error) { console.error('Chyba bid:', error.message); res.status(500).json({ message: 'Serverová chyba.' }); }
});

// --- MAZANIE JE ODSTRÁNENÉ ---

// Pomocná funkcia pre Proxy Bidding
async function runProxyBidding(auction) { /* ... kód zostáva rovnaký ako v predchádzajúcej verzii ... */ }
// =============================================================
// Skopíruj sem kód funkcie runProxyBidding z predchádzajúcej verzie server.js
// Tento kód je dlhý a zostal nezmenený
// =============================================================
