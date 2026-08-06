const { startBots } = require('./botManager');

startBots()
  .then((clients) => {
    console.log(`[index] Multibot iniciado con ${clients.length} bot(s).`);
  })
  .catch((err) => {
    console.error('[index] Error fatal iniciando el multibot:', err);
    process.exit(1);
  });

process.on('unhandledRejection', (err) => {
  console.error('[index] Unhandled rejection:', err);
});
