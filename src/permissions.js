const { masterSuperUserId } = require('./config');

/**
 * IDs adicionales autorizados como "superusuario" (además del master fijo
 * en config.js). Viven en memoria mientras el proceso está corriendo; si el
 * proceso se reinicia, quedan solo el master y hay que volver a agregarlos
 * con $control add.
 */
const extraSuperUsers = new Set();

/**
 * Un superusuario puede $c / $d cualquier bot sin importar quién lo haya
 * conectado ni si ya está activo en otro VC.
 */
function isSuperUser(userId) {
  return userId === masterSuperUserId || extraSuperUsers.has(userId);
}

/**
 * Solo el master (el ID fijo) puede otorgar/quitar el permiso de
 * superusuario a otras personas con $control.
 */
function isMaster(userId) {
  return userId === masterSuperUserId;
}

function addSuperUser(userId) {
  extraSuperUsers.add(userId);
}

function removeSuperUser(userId) {
  extraSuperUsers.delete(userId);
}

module.exports = {
  masterSuperUserId,
  isSuperUser,
  isMaster,
  addSuperUser,
  removeSuperUser,
};
