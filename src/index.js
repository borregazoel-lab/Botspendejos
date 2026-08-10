const { startBots } = require('./botManager');

startBots()
  .then((clients) => {
    console.log(`[index] Aviso "bot off" enviado y ${clients.length} bot(s) desconectados. Sistema apagado.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('[index] Error fatal iniciando el multibot:', err);
    process.exit(1);
  });

process.on('unhandledRejection', (err) => {
  console.error('[index] Unhandled rejection:', err);
});
