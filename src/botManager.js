const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { tokens, allowedGuildIds } = require('./config');
const { attachCommands } = require('./commands');
const { attachVoiceHandler } = require('./voiceHandler');

const clients = [];

/**
 * Si hay una lista blanca configurada (ALLOWED_GUILD_IDS), obliga al bot a
 * salirse de cualquier servidor que no esté en esa lista. Se revisa al
 * arrancar (por si ya estaba en uno no permitido) y cada vez que lo agregan
 * a un servidor nuevo.
 */
function enforceAllowedGuilds(client) {
  if (allowedGuildIds.length === 0) return; // sin restriccion configurada

  const leaveIfNotAllowed = async (guild) => {
    if (allowedGuildIds.includes(guild.id)) return;
    console.warn(`[botManager] ⚠️ ${client.user.tag} fue agregado a un servidor no autorizado (${guild.name} / ${guild.id}). Saliendo...`);
    try {
      await guild.leave();
    } catch (err) {
      console.error(`[botManager] No se pudo salir del servidor ${guild.id}:`, err);
    }
  };

  // Revision al arrancar, por si ya estaba en algun servidor no permitido.
  client.once('clientReady', () => {
    client.guilds.cache.forEach((guild) => leaveIfNotAllowed(guild));
  });

  // Salida automatica e inmediata si lo agregan a uno nuevo no permitido.
  client.on('guildCreate', (guild) => leaveIfNotAllowed(guild));
}

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

    client.once('clientReady', () => {
      console.log(`[botManager] ✅ Conectado: ${client.user.tag} (ID: ${client.user.id})`);
    });

    client.on('error', (err) => {
      console.error(`[botManager] Error en un client:`, err);
    });

    attachCommands(client);
    attachVoiceHandler(client);
    enforceAllowedGuilds(client);

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
