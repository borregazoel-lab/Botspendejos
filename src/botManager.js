const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { tokens } = require('./config');
const { attachCommands } = require('./commands');
const { attachVoiceHandler } = require('./voiceHandler');

const clients = [];

async function startBots() {
  if (tokens.length === 0) {
    console.error('[botManager] No hay tokens configurados. Nada que iniciar.');
    return clients;
  }

  for (const token of tokens) {
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel],
    });

    client.once('ready', () => {
      console.log(`[botManager] ✅ Conectado: ${client.user.tag} (ID: ${client.user.id})`);
    });

    client.on('error', (err) => {
      console.error(`[botManager] Error en un client:`, err);
    });

    attachCommands(client);
    attachVoiceHandler(client);

    try {
      await client.login(token);
      clients.push(client);
    } catch (err) {
      console.error('[botManager] ❌ No se pudo iniciar sesion con uno de los tokens:', err.message);
    }
  }

  return clients;
}

module.exports = { startBots, clients };
