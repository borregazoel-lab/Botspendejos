const { ChannelType } = require('discord.js');
const { prefix } = require('./config');
const { getState } = require('./state');
const { connectBotToChannel, disconnectBot } = require('./voiceHandler');

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
    }
  });
}

async function handleConnect(client, message, args) {
  const [botId, vcId] = args;

  if (!botId || !vcId) return; // formato invalido, ignorar en silencio para no ensuciar el chat con varios bots

  // Este comando no es para este bot.
  if (botId !== client.user.id) return;

  const existing = getState(client.user.id);

  // Regla 1 / 2: si el bot ya esta activo (conectado a un VC), NO puede
  // ser "robado" ni movido con comandos por nadie, ni siquiera para
  // reconectarlo al mismo canal. Primero hay que desconectarlo con $d.
  if (existing && existing.active) {
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
    connectBotToChannel(client, message.guild, channel, message.author.id);
    await message.reply(` **${client.user.username}** se proyecto  **${channel.name}**.`);
  } catch (err) {
    console.error(`[commands] Error conectando ${client.user.tag} al VC ${vcId}:`, err);
    await message.reply(' Ocurrio un error al intentar conectarme a ese canal (revisa mis permisos: Ver canal / Conectar).');
  }
}

async function handleDisconnect(client, message, args) {
  const [botId] = args;

  if (!botId) return;
  if (botId !== client.user.id) return;

  const state = getState(client.user.id);

  if (!state || !state.active) {
    await message.reply(` **${client.user.username}** no estoy en vc.`);
    return;
  }

  // Regla 2: solo quien lo conecto puede desconectarlo.
  if (state.ownerId !== message.author.id) {
    await message.reply(` Solo <@${state.ownerId}> (quien lo conecto) puede desconectar a **${client.user.username}**.`);
    return;
  }

  disconnectBot(client, state.guildId);
  await message.reply(`**${client.user.username}** me desproyecte.`);
}

module.exports = { attachCommands };
