// Importujeme potrebné balíčky
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Inicializujeme aplikáciu Express
const app = express();

// Render nám pridelí port cez premennú prostredia, alebo použijeme 3000 lokálne
const port = process.env.PORT || 3000;

// Použijeme middleware
app.use(cors()); // Povolí požiadavky z iných domén (napr. z tvojho frontendu)
app.use(express.json()); // Umožní serveru čítať JSON dáta poslané v tele požiadavky

// -----------------------------------------------------------------
// Pripojenie k MongoDB Atlas
// -----------------------------------------------------------------

// Zoberieme pripájací reťazec z premennej prostredia, ktorú sme nastavili na Renderi
const dbURI = process.env.MONGODB_URI;

// Ak adresa (dbURI) nebola nájdená v premenných prostredia, vypíš chybu
if (!dbURI) {
  console.error('CHYBA: MONGODB_URI nebola nájdená v premenných prostredia!');
  console.error('Prosím, nastav ju v záložke Environment na Render.com');
  process.exit(1); // Zastaví aplikáciu
}

// Pokúsime sa pripojiť k databáze
mongoose.connect(dbURI)
  .then(() => {
    // Ak sa pripojenie podarilo
    console.log('ÚSPECH: Databáza MongoDB je úspešne pripojená.');
    
    // Server začne počúvať požiadavky až po úspešnom pripojení k DB
    app.listen(port, () => {
      console.log(`Server bol spustený a beží na porte ${port}`);
    });
  })
  .catch(err => {
    // Ak pripojenie zlyhalo
    console.error('ZLYHANIE: Nepodarilo sa pripojiť k MongoDB.');
    console.error(err.message); // Vypíše dôvod chyby
    process.exit(1); // Zastaví aplikáciu
  });

// -----------------------------------------------------------------
// Testovacia "route" (adresa)
// -----------------------------------------------------------------

// Toto je len na otestovanie, či server žije
// Keď zadáš https://e-drazba-server.onrender.com/ do prehliadača, toto sa zobrazí
app.get('/', (req, res) => {
  res.send('Vitajte na E-Drazba API serveri! Server beží a je pripravený.');
});
