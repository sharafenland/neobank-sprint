/* Exports the card decks to handout/cards.json so the PDF cannot drift from the game. */
const fs = require("node:fs");
const path = require("node:path");
const { FEATURES, INCIDENTS, EVENTS, PRACTICES, PHASES } = require("../.test-build/cards");
const out = path.join(__dirname, "..", "handout", "cards.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ FEATURES, INCIDENTS, EVENTS, PRACTICES, PHASES }, null, 1));
console.log(`exported ${FEATURES.length} features, ${INCIDENTS.length} incidents, ${EVENTS.length} events, ${PRACTICES.length} practices`);
