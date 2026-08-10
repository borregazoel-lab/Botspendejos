const { Client, GatewayIntentBits, Partials, ChannelType, PermissionsBitField } = require('discord.js');
const { tokens } = require('./config');
const { attachCommands } = require('./commands');
const { attachVoiceHandler } = require('./voiceHandler');

const clients = [];

/**
 * ================== MODO APAGADO (KILL-SWITCH) ==================
 * El hosting se bugueo y no desconectaba a los bots entre despliegues,
 * asi que este proceso YA NO pone a los bots en linea de forma funcional:
 * no se registran comandos ($c/$d/$control) ni el manejador de voz. Lo
 * unico que hace es iniciar sesion, mandar un aviso "bot off" (solo con
 * el bot de BOT_TOKEN_1) a TODOS los canales de texto donde ese bot tenga
 * permiso de escribir, en todos los servidores donde este, y luego
 * desconectar/destruir TODOS los clients para que queden offline.
 *
 * Para volver a activar el bot normalmente: descomentar las llamadas a
 * attachCommands / attachVoiceHandler mas abajo y quitar el bloque de
 * "avisar y apagar" al final de startBots(). Ya no hay lista blanca de
 * servidores (ALLOWED_GUILD_IDS): el bot nunca se sale solo.
 * ===================================================================
 */

/**
 * Devuelve TODOS los canales de texto de un guild donde el bot pueda
 * escribir (permisos de Ver canal + Enviar mensajes).
 */
function findWritableTextChannels(guild) {
  const me = guild.members.me;
  return guild.channels.cache.filter((channel) => {
    if (channel.type !== ChannelType.GuildText) return false;
    const perms = channel.permissionsFor(me);
    return (
      perms?.has(PermissionsBitField.Flags.ViewChannel) &&
      perms?.has(PermissionsBitField.Flags.SendMessages)
    );
  });
}

/**
 * Manda "bot off" a TODOS los canales de texto donde el bot tenga permiso
 * de escribir, en todos los servidores del client indicado. Solo se debe
 * llamar con el bot de BOT_TOKEN_1 (el primero de la lista de tokens).
 */
async function sendShutdownNotice(client) {
  for (const guild of client.guilds.cache.values()) {
    const channels = findWritableTextChannels(guild);

    if (channels.size === 0) {
      console.warn(`[botManager] No encontre ningun canal de texto para avisar en ${guild.name} (${guild.id}).`);
      continue;
    }

    for (const channel of channels.values()) {
      try {
        await channel.send('bot off');
      } catch (err) {
        console.error(`[botManager] Error mandando el aviso en #${channel.name} de ${guild.name} (${guild.id}):`, err);
      }
    }
  }
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
      console.log(`[botManager] Sesion iniciada (modo apagado): ${client.user.tag} (ID: ${client.user.id})`);
    });

    client.on('error', (err) => {
      console.error(`[botManager] Error en un client:`, err);
    });

    // Todas las funciones quedan desactivadas: no se registran comandos ni
    // el manejador de voz.
    // attachCommands(client);
    // attachVoiceHandler(client);

    try {
      await client.login(token);
      clients.push(client);
    } catch (err) {
      console.error('[botManager] No se pudo iniciar sesion con uno de los tokens:', err.message);
    }
  }

  // Solo el bot de BOT_TOKEN_1 (el primer token de la lista) manda el
  // aviso "bot off" a todos los servidores donde este.
  if (clients.length > 0) {
    console.log('[botManager] Mandando aviso "bot off" con el bot de BOT_TOKEN_1...');
    await sendShutdownNotice(clients[0]);
  }

  // Apagar todo: se destruyen las sesiones de TODOS los bots para que
  // queden offline (ya no hay comandos ni voz activos de todas formas).
  console.log('[botManager] Aviso enviado. Desconectando todos los bots...');
  for (const client of clients) {
    client.destroy();
  }

  return clients;
}

module.exports = { startBots, clients };
