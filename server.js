const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Importujeme náš zjednodušený (ale opravený) model
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
app.get('/', (req, res) => { res.send('Vitajte na E-Drazba API serveri! (Zjednodušená verzia)'); });

// 2. GET Všetky aukcie (Zostáva rovnaký)
app.get('/api/drazby', async (req, res) => { 
    try {
        const allAuctions = await Auction.find({}).sort({ createdAt: -1 });
        res.status(200).json(allAuctions);
    } catch (error) {
        console.error('Chyba GET /api/drazby:', error.message);
        res.status(500).json({ message: 'Serverová chyba.' });
    }
});

// ===== ZMENA: POST Nová aukcia (Prispôsobené zjednodušenému modelu) =====
app.post('/api/drazby', async (req, res) => {
  try {
    console.log('Prijaté dáta pre novú dražbu:', req.body);
    
    // Extrahujeme len polia, ktoré očakávame v zjednodušenom modeli
    const { 
        navrhovatel, 
        okres, 
        adresa, 
        predmetDrazby, // Toto sme vrátili
        najnizsiePodanie, 
        minimalnePrihodenie, 
        mobilNavrhovatela, 
        casZaciatku, 
        casSkoncenia 
    } = req.body;

    // Vytvoríme nový objekt len s potrebnými dátami
    const auctionData = {
        navrhovatel, 
        okres, 
        adresa, 
        predmetDrazby, 
        najnizsiePodanie, 
        minimalnePrihodenie, 
        mobilNavrhovatela, 
        casZaciatku, 
        casSkoncenia
        // Ostatné polia ako currentPrice, highestBidder, bidHistory sa nastavia automaticky (default/hook)
    };

    // Vytvoríme a uložíme novú dražbu
    const novaDrazba = new Auction(auctionData);
    const ulozenaDrazba = await novaDrazba.save(); // Tu sa spustí aj 'pre-save' hook

    console.log('Nová dražba úspešne uložená:', ulozenaDrazba._id);
    res.status(201).json(ulozenaDrazba);

  } catch (error) {
    // Ak validácia v modeli zlyhá (napr. chýba povinné pole)
    console.error('Chyba pri ukladaní novej dražby:', error.message);
    res.status(400).json({ message: 'Chyba pri ukladaní dát: ' + error.message });
  }
});
// =======================================================================

// 4. GET Detail jednej aukcie (Zostáva rovnaký)
app.get('/api/drazby/:id', async (req, res) => { /* ... kód ... */ });

// 5. POST Nastavenie Proxy Bidu (Zostáva rovnaký)
app.post('/api/drazby/:id/setproxy', async (req, res) => { /* ... kód ... */ });

// 6. POST Manuálne Prihodenie (Zostáva rovnaký)
app.post('/api/drazby/:id/bid', async (req, res) => { /* ... kód ... */ });

// 7. DELETE Mazanie aukcie (Zostáva rovnaký)
app.delete('/api/drazby/:id', async (req, res) => { /* ... kód ... */ });


// --- Pomocná funkcia pre Proxy Bidding (Zostáva rovnaká) ---
async function runProxyBidding(auction) { /* ... kód ... */ }


// ===== Tu skopíruj kód pre ostatné endpointy (4, 5, 6, 7) a funkciu runProxyBidding z PREDCHÁDZAJÚCEJ verzie server.js =====
// Je dôležité, aby tu boli všetky! Skopíroval som ich sem pre istotu.

// 4. GET Detail jednej aukcie 
app.get('/api/drazby/:id', async (req, res) => {
  try {
    const auctionId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(auctionId)) {
        return res.status(400).json({ message: 'Neplatné ID dražby' }); // 400 Bad Request je vhodnejšie ako 404
    }
    const auction = await Auction.findById(auctionId);
    if (!auction) {
      return res.status(404).json({ message: 'Dražba nebola nájdená' });
    }
    res.status(200).json(auction);
  } catch (error) {
    console.error('Chyba GET /api/drazby/:id:', error.message);
    res.status(500).json({ message: 'Nastala chyba na serveri.' });
  }
});

// 5. POST Nastavenie Proxy Bidu 
app.post('/api/drazby/:id/setproxy', async (req, res) => {
    try {
        const auctionId = req.params.id;
        const { bidderId, maxBid } = req.body; 

        if (!mongoose.Types.ObjectId.isValid(auctionId)) return res.status(400).json({ message: 'Neplatné ID dražby' });
        if (!bidderId) return res.status(400).json({ message: 'Chýba bidderId' });
        if (maxBid === undefined || maxBid === null || isNaN(maxBid) || maxBid <= 0) {
             return res.status(400).json({ message: 'Neplatná maximálna ponuka (maxBid)' });
        }
        
        const auction = await Auction.findById(auctionId);
        if (!auction) return res.status(404).json({ message: 'Dražba nebola nájdená' });

        if (maxBid < auction.najnizsiePodanie) {
            return res.status(400).json({ message: `Maximálna ponuka musí byť aspoň ${auction.najnizsiePodanie.toLocaleString('sk-SK')} €.` });
        }

        const existingProxyIndex = auction.proxyBids.findIndex(p => p.bidderId === bidderId);
        if (existingProxyIndex > -1) {
             // Ak existuje a nový maxBid je nižší, nedovolíme (alebo by sme mohli dovoliť znížiť?)
            // if (maxBid < auction.proxyBids[existingProxyIndex].maxBid) {
            //     return res.status(400).json({ message: `Nový limit nemôže byť nižší ako predchádzajúci.` });
            // }
            auction.proxyBids[existingProxyIndex].maxBid = maxBid;
        } else {
            auction.proxyBids.push({ bidderId, maxBid });
        }
        
        // Spustíme proxy bidding
        await runProxyBidding(auction);
        const updatedAuction = await auction.save();
        
        res.status(200).json({ message: 'Maximálna ponuka úspešne nastavená.', auction: updatedAuction });

    } catch (error) {
        console.error('Chyba POST /api/drazby/:id/setproxy:', error.message);
        res.status(500).json({ message: 'Nastala chyba na serveri.' });
    }
});

// 6. POST Manuálne Prihodenie 
app.post('/api/drazby/:id/bid', async (req, res) => {
  try {
    const auctionId = req.params.id;
    const { amount, bidderId } = req.body; 
    
    if (!mongoose.Types.ObjectId.isValid(auctionId)) return res.status(400).json({ message: 'Neplatné ID dražby' });
    if (!bidderId) return res.status(400).json({ message: 'Chýba bidderId.' });
    if (!amount || isNaN(amount) || amount <= 0) return res.status(400).json({ message: 'Musíte zadať platnú sumu.' });

    const auction = await Auction.findById(auctionId);
    if (!auction) return res.status(404).json({ message: 'Dražba nebola nájdená' });

    const now = new Date();
    if (now > auction.casSkoncenia) return res.status(400).json({ message: 'Táto aukcia sa už skončila.' });
    if (now < auction.casZaciatku) return res.status(400).json({ message: 'Táto aukcia sa ešte nezačala.' });
    
    const bidderProxy = auction.proxyBids.find(p => p.bidderId === bidderId);
    if (bidderProxy && amount > bidderProxy.maxBid) {
        return res.status(400).json({ message: `Ponuka prekračuje Váš limit ${bidderProxy.maxBid.toLocaleString('sk-SK')} €. Zvýšte limit alebo ponúknite menej.` });
    }

    const requiredMinBid = (auction.currentPrice || 0) + (auction.minimalnePrihodenie || 1);
    // Ak už je najvyšší, NEPOVOLÍME mu prihodiť MENEJ ako je requiredMinBid (aj keď by to bola jeho vlastná ponuka)
    if (amount < requiredMinBid) { 
      return res.status(400).json({ 
        message: `Ponuka je príliš nízka. Minimum je ${requiredMinBid.toLocaleString('sk-SK')} €.` 
      });
    }
    // Ak prihadzuje ROVNAKO ako je current price a NIE JE highest bidder, nepovolíme
    if (amount === auction.currentPrice && auction.highestBidder !== bidderId) {
         return res.status(400).json({ message: `Musíte ponúknuť viac ako aktuálna cena.` });
    }


    // Spracovanie manuálneho prihodenia
    console.log(`Manuálne prihodenie: ${bidderId} prihadzuje ${amount}`);
    const newManualBid = { bidderId: bidderId, amount: amount, timestamp: new Date() };
    
    // Prihodenie sa zapíše len ak je vyššie, alebo ak je prvé
    if (amount > auction.currentPrice || auction.bidHistory.length === 0) {
        auction.currentPrice = amount;
        auction.highestBidder = bidderId;
    } 
    // Záznam do histórie pridáme vždy (aj keď neprehodil cenu, napr. dorovnal svoj proxy bid)
    auction.bidHistory.push(newManualBid); 

    // Spustíme proxy bidding
    await runProxyBidding(auction);
    
    const finalAuctionState = await auction.save();
    res.status(200).json(finalAuctionState);

  } catch (error) {
    console.error('Chyba POST /api/drazby/:id/bid:', error.message);
    res.status(500).json({ message: 'Nastala chyba na serveri.' });
  }
});

// 7. DELETE Mazanie aukcie 
app.delete('/api/drazby/:id', async (req, res) => {
    try {
        const auctionId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(auctionId)) return res.status(400).json({ message: 'Neplatné ID dražby' });
        console.log(`Mazanie aukcie ID: ${auctionId}`);
        const result = await Auction.findByIdAndDelete(auctionId);
        if (!result) return res.status(404).json({ message: 'Dražba nebola nájdená' });
        console.log(`Aukcia ID ${auctionId} zmazaná.`);
        res.status(200).json({ message: 'Dražba bola úspešne zmazaná.' });
    } catch (error) {
        console.error('Chyba DELETE /api/drazby/:id:', error.message);
        res.status(500).json({ message: 'Nastala chyba pri mazaní.' });
    }
});

// Pomocná funkcia pre Proxy Bidding 
async function runProxyBidding(auction) {
    console.log(`Spúšťam proxy bidding pre ${auction._id}, cena: ${auction.currentPrice}`);
    let auctionUpdated = false; 

    while (true) { 
        const currentHighestBidderId = auction.highestBidder;
        const currentPrice = auction.currentPrice || 0; // Zaistiť, že je to číslo
        const minIncrement = auction.minimalnePrihodenie || 1; // Zaistiť, že je to číslo > 0
        const nextRequiredBid = currentPrice + minIncrement;

        const potentialProxyBidders = auction.proxyBids.filter(proxy => 
            proxy.bidderId !== currentHighestBidderId && 
            proxy.maxBid >= nextRequiredBid &&
            proxy.maxBid > currentPrice // Ich limit musí byť vyšší ako aktuálna cena
        );

        if (potentialProxyBidders.length === 0) { break; }

        potentialProxyBidders.sort((a, b) => b.maxBid - a.maxBid);
        const topProxyBidder = potentialProxyBidders[0];

        // Kto je druhý najvyšší (môže byť aj pôvodný highest bidder, ak má proxy)
        const competitors = auction.proxyBids.filter(p => 
            p.bidderId !== topProxyBidder.bidderId && // Nesmie to byť top bidder
            p.maxBid > currentPrice // Jeho limit musí byť tiež nad aktuálnou cenou
        );
        competitors.sort((a, b) => b.maxBid - a.maxBid);
        const secondHighestProxyMax = competitors.length > 0 ? competitors[0].maxBid : 0;
        
        // Ak aktuálny highest bidder nemá proxy, jeho "limit" je jeho posledná ponuka
        const currentHighestEffectiveMax = auction.proxyBids.find(p => p.bidderId === currentHighestBidderId)?.maxBid || currentPrice;

        // Berieme vyšší z limitov konkurencie
        const highestCompetitorLimit = Math.max(secondHighestProxyMax, currentHighestEffectiveMax);

        let autoBidAmount;
        if (highestCompetitorLimit >= currentPrice) {
            // Prihodíme len minimálne nad najvyššiu konkurenciu, max do nášho limitu
             autoBidAmount = Math.min(topProxyBidder.maxBid, highestCompetitorLimit + minIncrement);
        } else {
             // Ak nie je konkurencia nad aktuálnou cenou, prihodíme len minimum
             autoBidAmount = Math.min(topProxyBidder.maxBid, nextRequiredBid);
        }
        
        // Ešte raz zaistíme, že nejdeme pod minimum
        autoBidAmount = Math.max(autoBidAmount, nextRequiredBid);

        // Ak top proxy bidder nemôže ponúknuť ani túto sumu, končíme
        if (topProxyBidder.maxBid < autoBidAmount) { break; }
        
        // Ak by autoBidAmount bolo rovnaké ako currentPrice (stane sa, ak niekto dorovná svoj max bid manuálne)
        // a topProxyBidder už JE highest bidder, nemusíme robiť nič
        if(autoBidAmount === currentPrice && topProxyBidder.bidderId === currentHighestBidderId) {
             break; 
        }

        console.log(`Automatické prihodenie: ${topProxyBidder.bidderId} -> ${autoBidAmount} €`);

        const newProxyBid = { bidderId: topProxyBidder.bidderId, amount: autoBidAmount, timestamp: new Date() };
        auction.currentPrice = autoBidAmount;
        auction.highestBidder = topProxyBidder.bidderId;
        auction.bidHistory.push(newProxyBid);
        auctionUpdated = true;
    }
    console.log(`Proxy bidding ukončený. Cena: ${auction.currentPrice}`);
    return auctionUpdated; 
}
// =============================================================
