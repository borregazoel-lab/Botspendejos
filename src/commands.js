const { ChannelType } = require('discord.js');
const { prefix } = require('./config');
const { getState } = require('./state');
const { connectBotToChannel, disconnectBot } = require('./voiceHandler');
const { isSuperUser, isMaster, addSuperUser, removeSuperUser } = require('./permissions');

/**
 * $control no es un comando "por bot" (no lleva ID de bot), así que TODOS
 * los clients del proceso lo reciben y procesarían por igual. Para no
 * responder una vez por cada bot conectado, se guarda el ID del mensaje ya
 * procesado (el Set vive una sola vez por proceso, compartido por todos los
 * clients gracias al cache de módulos de Node).
 */
const processedControlMessages = new Set();

/**
 * Extrae un ID de usuario/bot ya sea que venga como ID plano o como
 * mención/ping (<@id> o <@!id>). Devuelve null si no es ninguno de los dos.
 * Esto es lo que permite usar $c / $d haciendo ping al bot en vez de tener
 * que escribir su ID a mano.
 */
function extractId(raw) {
  if (!raw) return null;
  const mention = raw.match(/^<@!?(\d+)>$/);
  if (mention) return mention[1];
  if (/^\d+$/.test(raw)) return raw;
  return null;
}

/**
 * Registra el listener de mensajes para un client (bot) concreto.
 * Cada bot escucha TODOS los mensajes con el prefijo, pero solo
 * reacciona si el ID indicado en el comando coincide con su propio ID
 * (client.user.id, que es el mismo valor que el application id).
 */
function attachCommands(client) {
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const cmd = args.shift()?.toLowerCase();
    if (!cmd) return;

    if (cmd === 'c') {
      await handleConnect(client, message, args);
    } else if (cmd === 'd' || cmd === 'disconnect') {
      await handleDisconnect(client, message, args);
    } else if (cmd === 'control') {
      await handleControl(client, message, args);
    }
  });
}

async function handleConnect(client, message, args) {
  const [rawBotId, vcId] = args;
  const botId = extractId(rawBotId);

  if (!botId || !vcId) return; // formato invalido, ignorar en silencio para no ensuciar el chat con varios bots

  // Este comando no es para este bot.
  if (botId !== client.user.id) return;

  const requesterId = message.author.id;
  const requesterIsSuperUser = isSuperUser(requesterId);

  const existing = getState(client.user.id);

  // Regla 1 / 2: si el bot ya esta activo (conectado a un VC), NO puede
  // ser "robado" ni movido con comandos por nadie, ni siquiera para
  // reconectarlo al mismo canal. Primero hay que desconectarlo con $d.
  // EXCEPCION: un superusuario si puede sacarlo/meterlo aunque no lo haya
  // puesto el en el VC y aunque ya este activo en otro lado.
  if (existing && existing.active && !requesterIsSuperUser) {
    await message.reply(
      ` **${client.user.username}** ya estoy proyectandome gracias. ` +
      `Solo quien lo conecto puede desconectarlo con \`${prefix}d ${client.user.id}\` antes de volver a usarlo.`
    );
    return;
  }

  const channel = await message.guild.channels.fetch(vcId).catch(() => null);

  if (!channel || (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice)) {
    await message.reply(' No encontre ese canal we. Revisa el ID.');
    return;
  }

  try {
    // Si un superusuario esta "moviendo" un bot que ya estaba activo en
    // otro VC, primero soltamos la conexion anterior antes de reconectar.
    if (existing && existing.active && requesterIsSuperUser) {
      disconnectBot(client, existing.guildId);
    }

    connectBotToChannel(client, message.guild, channel, requesterId);
    await message.reply(` **${client.user.username}** se proyecto  **${channel.name}**.`);
  } catch (err) {
    console.error(`[commands] Error conectando ${client.user.tag} al VC ${vcId}:`, err);
    await message.reply(' Ocurrio un error al intentar conectarme a ese canal (revisa mis permisos: Ver canal / Conectar).');
  }
}

async function handleDisconnect(client, message, args) {
  const [rawBotId] = args;
  const botId = extractId(rawBotId);

  if (!botId) return;
  if (botId !== client.user.id) return;

  const state = getState(client.user.id);

  if (!state || !state.active) {
    await message.reply(` **${client.user.username}** no estoy en vc.`);
    return;
  }

  const requesterId = message.author.id;

  // Regla 2: solo quien lo conecto puede desconectarlo.
  // EXCEPCION: un superusuario puede desconectarlo aunque no lo haya
  // conectado el.
  if (state.ownerId !== requesterId && !isSuperUser(requesterId)) {
    await message.reply(` Solo <@${state.ownerId}> (quien lo conecto) puede desconectar a **${client.user.username}**.`);
    return;
  }

  disconnectBot(client, state.guildId);
  await message.reply(`**${client.user.username}** me desproyecte.`);
}

/**
 * $control add <id>   -> le da permiso de superusuario a ese ID
 * $control delete <id> -> le quita el permiso de superusuario a ese ID
 * Solo el master (ID fijo en config.js) puede usar este comando.
 */
async function handleControl(client, message, args) {
  // Deduplicar: este comando llegaria una vez por cada bot corriendo en el
  // proceso, pero solo debe responderse una vez.
  if (processedControlMessages.has(message.id)) return;
  processedControlMessages.add(message.id);
  setTimeout(() => processedControlMessages.delete(message.id), 60_000);

  if (!isMaster(message.author.id)) {
    await message.reply(' No tienes permiso para usar este comando.');
    return;
  }

  const [sub, rawTarget] = args;
  const subCmd = sub?.toLowerCase();
  const targetId = extractId(rawTarget);

  if (!subCmd || !targetId || (subCmd !== 'add' && subCmd !== 'delete')) {
    await message.reply(` Uso: \`${prefix}control add <id>\` o \`${prefix}control delete <id>\` (tambien acepta ping en vez de ID).`);
    return;
  }

  if (subCmd === 'add') {
    if (isMaster(targetId)) {
      await message.reply(' Ese ID ya tiene el permiso de superusuario por defecto.');
      return;
    }
    addSuperUser(targetId);
    await message.reply(` <@${targetId}> ahora es superusuario: puede sacar y meter cualquier bot con \`${prefix}c\` / \`${prefix}d\`.`);
  } else {
    if (isMaster(targetId)) {
      await message.reply(' Ese ID es el superusuario principal y no se le puede quitar el permiso.');
      return;
    }
    removeSuperUser(targetId);
    await message.reply(` Se le quito el permiso de superusuario a <@${targetId}>.`);
  }
}

module.exports = { attachCommands };
