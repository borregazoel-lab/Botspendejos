const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const { getState, setState, clearState } = require('./state');

/**
 * IMPORTANTE: @discordjs/voice guarda sus conexiones de voz en un registro
 * interno agrupado por "group" (ademas del guildId). Si varios bots del
 * mismo proceso se conectan al MISMO servidor y no se especifica un group
 * distinto para cada uno, todos caen en el group "default" y se pisan entre
 * si (el registro de un bot sobreescribe al del otro), causando que solo
 * uno pueda quedarse conectado de verdad.
 *
 * Por eso aqui SIEMPRE usamos el ID del bot (client.user.id) como "group",
 * tanto al crear la conexion (joinVoiceChannel) como al buscarla
 * (getVoiceConnection). Asi cada bot tiene su propio carril, sin importar
 * cuantos bots compartan servidor.
 */

/**
 * Conecta el bot (client) a un canal de voz y guarda el estado
 * "hogar" de ese bot (guild + canal + dueno).
 */
function connectBotToChannel(client, guild, channel, ownerId) {
  joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: false,
    group: client.user.id,
  });

  setState(client.user.id, {
    active: true,
    ownerId,
    guildId: guild.id,
    channelId: channel.id,
  });
}

/**
 * Desconecta el bot por completo y borra su estado (vuelve a "idle",
 * esperando un nuevo $c). Se usa tanto para el comando $d como para
 * el caso en el que el VC se queda vacio tras un movimiento manual.
 */
function disconnectBot(client, guildId) {
  const connection = getVoiceConnection(guildId, client.user.id);
  if (connection) {
    connection.destroy();
  }
  clearState(client.user.id);
}

/**
 * Cuenta cuantos usuarios (que no sean el propio bot) hay en un canal,
 * usando la cache de voiceStates del guild (no requiere el intent
 * privilegiado de GuildMembers).
 */
function othersInChannel(guild, channelId, botId) {
  if (!channelId) return false;
  let count = 0;
  guild.voiceStates.cache.forEach((vs) => {
    if (vs.channelId === channelId && vs.id !== botId) {
      count += 1;
    }
  });
  return count > 0;
}

/**
 * Registra el listener de voiceStateUpdate para un client concreto.
 * Aqui vive toda la logica de "no se puede robar / mover el bot".
 */
function attachVoiceHandler(client) {
  client.on('voiceStateUpdate', (oldState, newState) => {
    // Solo nos interesan los cambios de voz del propio bot.
    if (newState.id !== client.user.id) return;

    const state = getState(client.user.id);

    // Si el bot no esta "activo" (no fue conectado con $c), no gestionamos nada:
    // por ejemplo si un admin lo mete manualmente a un VC sin usar comandos,
    // lo dejamos tranquilo (no forma parte del sistema de proteccion).
    if (!state || !state.active) return;

    // Si el canal nuevo es el mismo que el "hogar" registrado, no paso nada
    // relevante (pudo ser un simple update de mute/deaf). Ignorar.
    if (newState.channelId === state.channelId) return;

    // A partir de aqui, el bot fue sacado de su canal "hogar" SIN usar
    // el comando $d (si hubiera sido por $d, el estado ya habria sido
    // borrado antes de que llegue este evento, y el return de arriba
    // ("!state || !state.active") ya lo habria detenido).

    const guild = newState.guild;
    const wasHomeOccupied = othersInChannel(guild, state.channelId, client.user.id);

    if (wasHomeOccupied) {
      // Regla 3: si en su VC de origen habia alguien mas al momento de
      // moverlo, el bot vuelve automaticamente a ese VC.
      try {
        joinVoiceChannel({
          channelId: state.channelId,
          guildId: state.guildId,
          adapterCreator: guild.voiceAdapterCreator,
          selfDeaf: true,
          selfMute: false,
          group: client.user.id,
        });
      } catch (err) {
        console.error(`[voice] Error al forzar el regreso del bot ${client.user.tag}:`, err);
      }
      // El "hogar" (state.channelId / ownerId) NO cambia.
    } else {
      // Regla 4: si el VC estaba solo con el bot, al moverlo manualmente
      // simplemente se desconecta y vuelve al estado "idle" ($c).
      disconnectBot(client, state.guildId);
    }
  });
}

module.exports = {
  connectBotToChannel,
  disconnectBot,
  attachVoiceHandler,
  othersInChannel,
};
