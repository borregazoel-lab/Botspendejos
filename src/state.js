/**
 * Estado en memoria de cada bot manejado por el multibot.
 *
 * Clave: ID del bot (client.user.id, que es el mismo valor que el
 * "application id" para bots normales de Discord).
 *
 * Valor:
 * {
 *   active: boolean,        // si el bot esta actualmente "asignado" a un VC
 *   ownerId: string,        // ID del usuario que lo conecto con $c
 *   guildId: string,        // guild donde esta
 *   channelId: string,      // VC al que esta ligado (su "hogar")
 * }
 *
 * Si un botId no tiene entrada en el Map, se considera "idle"
 * (esperando el comando $c).
 */
const botStates = new Map();

function getState(botId) {
  return botStates.get(botId);
}

function setState(botId, state) {
  botStates.set(botId, state);
}

function clearState(botId) {
  botStates.delete(botId);
}

module.exports = {
  botStates,
  getState,
  setState,
  clearState,
};
