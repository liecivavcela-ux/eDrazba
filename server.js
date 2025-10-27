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

app.get('/', (req, res) => { /* ... zostáva rovnaký ... */ 
    res.send('Vitajte na E-Drazba API serveri! Frontend je pripojený.');
});
app.get('/api/drazby', async (req, res) => { /* ... zostáva rovnaký ... */ 
    try {
        const allAuctions = await Auction.find({}).sort({ createdAt: -1 });
        res.status(200).json(allAuctions);
    } catch (error) {
        console.error('Chyba pri načítaní dražieb:', error.message);
        res.status(500).json({ message: 'Nastala chyba na serveri.' });
    }
});
app.post('/api/drazby', async (req, res) => { /* ... zostáva rovnaký ... */ 
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
app.get('/api/drazby/:id', async (req, res) => { /* ... zostáva rovnaký ... */ 
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


// ===== FUNKCIA PRE AUTOMATICKÉ PRIHADZOVANIE (PROXY BIDDING) =====
// Túto funkciu budeme volať po každom úspešnom manuálnom prihodení alebo nastavení proxy
async function runProxyBidding(auction) {
    console.log(`Spúšťam proxy bidding pre aukciu ID: ${auction._id}, aktuálna cena: ${auction.currentPrice}`);
    let auctionUpdated = false; // Flag, či sa niečo zmenilo

    while (true) { // Bude sa opakovať, kým budú prebiehať automatické prihodenia
        const currentHighestBidderId = auction.highestBidder;
        const currentPrice = auction.currentPrice;
        const minIncrement = auction.minimalnePrihodenie;
        const nextRequiredBid = currentPrice + minIncrement;

        // Nájdeme všetkých *iných* záujemcov, ktorí majú nastavený proxy limit
        // a ich limit je dostatočne vysoký na prekonanie aktuálnej ceny
        const potentialProxyBidders = auction.proxyBids.filter(proxy => 
            proxy.bidderId !== currentHighestBidderId && 
            proxy.maxBid >= nextRequiredBid
        );

        if (potentialProxyBidders.length === 0) {
            console.log("Žiadni ďalší proxy prihadzovači, ktorí by mohli prekonať cenu.");
            break; // Nikto nemôže alebo nechce prehodiť, končíme cyklus
        }

        // Z potenciálnych prihadzovačov vyberieme toho s najvyšším limitom
        potentialProxyBidders.sort((a, b) => b.maxBid - a.maxBid);
        const topProxyBidder = potentialProxyBidders[0];

        // Určíme sumu automatického prihodenia
        let autoBidAmount;

        // Má niekto iný (okrem topProxyBidder) tiež proxy bid, ktorý by mohol konkurovať?
        const secondHighestProxy = auction.proxyBids.find(p => 
            p.bidderId !== topProxyBidder.bidderId && 
            p.maxBid >= currentPrice // Stačí, ak je >= aktuálnej cene
        );

        if (secondHighestProxy && secondHighestProxy.maxBid >= currentPrice) {
            // Ak existuje druhý najvyšší proxy bid, prihodíme len minimálne nad neho
            // (ale nie viac ako náš vlastný limit)
             autoBidAmount = Math.min(topProxyBidder.maxBid, secondHighestProxy.maxBid + minIncrement);
        } else {
             // Ak nie je žiadna iná konkurencia, prihodíme len minimálne potrebnú sumu
             autoBidAmount = Math.min(topProxyBidder.maxBid, nextRequiredBid);
        }
        
        // Ešte jedna kontrola - ak by vypočítaná suma bola nižšia ako vyžadovaná, upravíme ju
        if (autoBidAmount < nextRequiredBid) {
             autoBidAmount = nextRequiredBid;
        }

        // Ak top proxy bidder nemôže ani len dorovnať požadovanú sumu (jeho maxBid je príliš nízky), končíme
        if (topProxyBidder.maxBid < autoBidAmount) {
             console.log(`Proxy bidder ${topProxyBidder.bidderId} dosiahol svoj limit ${topProxyBidder.maxBid}.`);
             break; 
        }

        console.log(`Automatické prihodenie: ${topProxyBidder.bidderId} prihadzuje ${autoBidAmount} (limit: ${topProxyBidder.maxBid})`);

        // Vykonáme automatické prihodenie
        const newProxyBid = {
            bidderId: topProxyBidder.bidderId,
            amount: autoBidAmount,
            timestamp: new Date()
        };
        auction.currentPrice = autoBidAmount;
        auction.highestBidder = topProxyBidder.bidderId;
        auction.bidHistory.push(newProxyBid);
        auctionUpdated = true;

        // Cyklus pokračuje, aby sme zistili, či niekto ďalší neprehodí túto novú sumu
    }

    console.log(`Proxy bidding ukončený. Finálna cena: ${auction.currentPrice}`);
    return auctionUpdated; // Vrátime, či sa aukcia zmenila
}
// =============================================================


// --- Endpoint 5: Nastavenie maximálnej ponuky (Proxy Bid) ---
app.post('/api/drazby/:id/setproxy', async (req, res) => {
    try {
        const auctionId = req.params.id;
        const { bidderId, maxBid } = req.body; // Očakávame ID záujemcu a jeho maximálnu ponuku

        // Validácia
        if (!mongoose.Types.ObjectId.isValid(auctionId)) return res.status(400).json({ message: 'Neplatné ID dražby' });
        if (!bidderId) return res.status(400).json({ message: 'Chýba bidderId' });
        if (maxBid === undefined || maxBid === null || isNaN(maxBid) || maxBid <= 0) {
             return res.status(400).json({ message: 'Neplatná maximálna ponuka (maxBid)' });
        }
        
        const auction = await Auction.findById(auctionId);
        if (!auction) return res.status(404).json({ message: 'Dražba nebola nájdená' });

        // Overenie času (môže sa nastaviť len počas trvania aukcie?) - Zatiaľ nie
        // const now = new Date();
        // if (now < auction.casZaciatku || now > auction.casSkoncenia) {
        //     return res.status(400).json({ message: 'Proxy bid je možné nastaviť len počas trvania aukcie.' });
        // }

        // Skontrolujeme, či je maxBid aspoň taký ako najnižšie podanie
        if (maxBid < auction.najnizsiePodanie) {
            return res.status(400).json({ message: `Maximálna ponuka musí byť aspoň ${auction.najnizsiePodanie.toLocaleString('sk-SK')} € (najnižšie podanie).` });
        }

        // Nájdem, či už tento bidder má nastavený proxy bid
        const existingProxyIndex = auction.proxyBids.findIndex(p => p.bidderId === bidderId);

        if (existingProxyIndex > -1) {
            // Ak už existuje, aktualizujeme jeho maxBid (len ak je nový vyšší?) - Zatiaľ len prepíšeme
            console.log(`Aktualizujem proxy bid pre ${bidderId} na ${maxBid}`);
            auction.proxyBids[existingProxyIndex].maxBid = maxBid;
        } else {
            // Ak neexistuje, pridáme nový záznam
            console.log(`Pridávam nový proxy bid pre ${bidderId} s limitom ${maxBid}`);
            auction.proxyBids.push({ bidderId, maxBid });
        }

        // ----- DÔLEŽITÉ: Spustíme proxy bidding -----
        // Je možné, že samotným nastavením limitu sa tento záujemca stane najvyšším prihadzujúcim
        await runProxyBidding(auction);
        // ------------------------------------------

        // Uložíme zmeny (či už len proxy bid, alebo aj výsledok automatického prihodenia)
        const updatedAuction = await auction.save();
        
        res.status(200).json({ message: 'Maximálna ponuka úspešne nastavená.', auction: updatedAuction });

    } catch (error) {
        console.error('Chyba pri nastavovaní proxy bid:', error.message);
        res.status(500).json({ message: 'Nastala chyba na serveri.' });
    }
});


// --- Endpoint 6: Manuálne Prihodenie na aukciu (upravené) ---
app.post('/api/drazby/:id/bid', async (req, res) => {
  try {
    const auctionId = req.params.id;
    const { amount, bidderId } = req.body; 
    
    // Validácia vstupov
    if (!mongoose.Types.ObjectId.isValid(auctionId)) return res.status(400).json({ message: 'Neplatné ID dražby' });
    if (!bidderId) return res.status(400).json({ message: 'Chýba bidderId.' });
    if (!amount || isNaN(amount) || amount <= 0) return res.status(400).json({ message: 'Musíte zadať platnú sumu.' });

    const auction = await Auction.findById(auctionId);
    if (!auction) return res.status(404).json({ message: 'Dražba nebola nájdená' });

    // Validačná logika (čas, minimálna suma)
    const now = new Date();
    if (now > auction.casSkoncenia) return res.status(400).json({ message: 'Táto aukcia sa už skončila.' });
    if (now < auction.casZaciatku) return res.status(400).json({ message: 'Táto aukcia sa ešte nezačala.' });
    
    // ----- ZMENA: Kontrola oproti vlastnému MAX BID -----
    // Zistíme, či tento prihadzujúci má nastavený proxy limit
    const bidderProxy = auction.proxyBids.find(p => p.bidderId === bidderId);
    if (bidderProxy && amount > bidderProxy.maxBid) {
        return res.status(400).json({ message: `Vaša ponuka ${amount.toLocaleString('sk-SK')} € prekračuje Váš nastavený limit ${bidderProxy.maxBid.toLocaleString('sk-SK')} €. Ak chcete ponúknuť viac, najprv zvýšte svoj limit.` });
        // Alternatívne by sme mohli limit automaticky zvýšiť, ale toto je bezpečnejšie
    }
    // ---------------------------------------------------

    const requiredMinBid = auction.currentPrice + auction.minimalnePrihodenie;
    if (amount < requiredMinBid && auction.highestBidder !== bidderId) { // Ak už je najvyšší, môže prihodiť rovnakú sumu (zbytočne, ale neblokujeme)
      return res.status(400).json({ 
        message: `Vaša ponuka je príliš nízka. Musíte ponúknuť aspoň ${requiredMinBid.toLocaleString('sk-SK')} €.` 
      });
    }

    // --- Spracovanie manuálneho prihodenia ---
    console.log(`Manuálne prihodenie: ${bidderId} prihadzuje ${amount}`);
    const newManualBid = {
      bidderId: bidderId,
      amount: amount,
      timestamp: new Date()
    };
    auction.currentPrice = amount;
    auction.highestBidder = bidderId;
    auction.bidHistory.push(newManualBid); 

    // ----- DÔLEŽITÉ: Spustíme proxy bidding -----
    // Po manuálnom prihodení skontrolujeme, či niekto iný s automatom neprehodí túto ponuku
    await runProxyBidding(auction);
    // ------------------------------------------

    // Uloženie finálneho stavu aukcie po všetkých prihodeniach
    const finalAuctionState = await auction.save();

    // Odoslanie finálneho stavu klientovi
    res.status(200).json(finalAuctionState);

  } catch (error) {
    console.error('Chyba pri spracovaní prihodenia:', error.message);
    res.status(500).json({ message: 'Nastala chyba na serveri.' });
  }
});
