require('dotenv').config();

/**
 * Lee la lista de tokens de bots desde variables de entorno.
 * Soporta tres formatos (se usa el primero que encuentre, en este orden):
 *
 *   1) Variables individuales numeradas (RECOMENDADO para Railway,
 *      porque se agregan una por una en la UI sin líos de comillas):
 *        BOT_TOKEN_1=token1
 *        BOT_TOKEN_2=token2
 *        BOT_TOKEN_3=token3
 *
 *   2) JSON array:      BOTS=["token1","token2"]
 *   3) Lista separada por comas: BOT_TOKENS=token1,token2,token3
 */
function loadTokens() {
  const numbered = Object.keys(process.env)
    .map((key) => {
      const match = key.match(/^BOT_TOKEN_(\d+)$/i);
      if (!match) return null;
      return { index: Number(match[1]), value: process.env[key] };
    })
    .filter(Boolean)
    .sort((a, b) => a.index - b.index)
    .map((entry) => String(entry.value).trim())
    .filter(Boolean);

  if (numbered.length > 0) {
    return numbered;
  }

  const rawJson = process.env.BOTS;
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((t) => String(t).trim()).filter(Boolean);
      }
    } catch (err) {
      console.error('[config] BOTS no es un JSON valido. Revisa el formato (debe ser un array). Error:', err.message);
    }
  }

  const rawCsv = process.env.BOT_TOKENS;
  if (rawCsv) {
    return rawCsv.split(',').map((t) => t.trim()).filter(Boolean);
  }

  return [];
}

const tokens = loadTokens();

if (tokens.length === 0) {
  console.error('[config] No se encontraron tokens. Define BOT_TOKEN_1, BOT_TOKEN_2, ... (recomendado) o BOTS (JSON array) o BOT_TOKENS (separado por comas) en tus variables de entorno.');
}

/**
 * ID de usuario con permiso total de "superusuario" sobre TODOS los bots:
 * puede $c / $d cualquier bot sin importar quién lo conectó ni si ya está
 * activo en otro VC. También es el único que puede otorgar/quitar ese
 * mismo permiso a otras personas con $control add / $control delete.
 */
const masterSuperUserId = process.env.MASTER_SUPERUSER_ID || '786993411605135411';

module.exports = {
  tokens,
  prefix: process.env.PREFIX || '$',
  masterSuperUserId,
};
