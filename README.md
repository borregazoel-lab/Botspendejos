# Discord Multibot – Voice Manager

Un solo programa Node.js que hostea **varios bots de Discord a la vez** y permite
controlarlos con comandos de texto para que entren/salgan de canales de voz,
con protección total contra "robo" o movimiento indebido.

## Comandos

Prefijo por defecto: `$` (configurable con `PREFIX`).

| Comando | Descripción |
|---|---|
| `$c <idDelBot> <idDelVC>` | Conecta ese bot (por su ID) al canal de voz indicado. |
| `$d <idDelBot>` o `$disconnect <idDelBot>` | Desconecta ese bot del VC. Solo funciona si lo ejecuta la misma persona que lo conectó. |

> El `<idDelBot>` es el **User ID del bot** (clic derecho sobre el bot → Copiar ID,
> con el modo desarrollador activado). Para bots normales, ese ID es el mismo
> que el "Application ID", así que sirve cualquiera de los dos.

## Reglas implementadas

1. **El bot nunca puede ser robado/movido con comandos.** Si ya está activo
   (conectado a un VC), `$c` es rechazado hasta que se use `$d` primero — sin
   importar quién lo pida.
2. **Solo quien lo conectó puede desconectarlo con `$d`.**
3. Si alguien **mueve manualmente** al bot desde Discord (arrastrándolo) y en
   su canal de origen había alguien más en ese momento, el bot **vuelve
   automáticamente** a su canal.
4. Si el bot estaba **solo** en el VC y lo mueven manualmente, el bot
   simplemente **se desconecta** y vuelve al estado inicial (esperando `$c`).
   Tampoco puede ser "reclamado" con comandos mientras está en ese estado
   intermedio... en este caso ya vuelve a estar libre para un nuevo `$c`.
5. Si todos los humanos salen del VC pero el bot sigue solo, **se queda ahí**
   (no hace nada hasta que lo muevan o lo desconecten).
6. Es multibot de verdad: cada bot tiene su propio token, su propio estado y
   se identifica por su propio ID, aunque todos corran con el mismo código y
   el mismo proceso.

## Configuración local

1. Instala dependencias:
   ```bash
   npm install
   ```
2. Copia `.env.example` a `.env` y pon tus tokens (una variable por bot):
   ```bash
   cp .env.example .env
   ```
   ```
   BOT_TOKEN_1=TOKEN_BOT_1
   BOT_TOKEN_2=TOKEN_BOT_2
   PREFIX=$
   ```
3. Ejecuta:
   ```bash
   npm start
   ```

## Configuración de cada bot en el Developer Portal

Para **cada** bot que vayas a hostear:

1. Ve a https://discord.com/developers/applications → tu aplicación → **Bot**.
2. Activa **"Message Content Intent"** (es obligatorio, si no, el bot no puede
   leer los comandos `$c`/`$d`).
3. Invita al bot a tu servidor con permisos mínimos:
   - `View Channel`
   - `Connect`
   - `Speak` (opcional, no reproduce audio pero no está de más)
4. Copia el **token** del bot y agrégalo como una nueva variable de entorno
   `BOT_TOKEN_N` (ver siguiente sección).

## Despliegue en Railway

1. Sube este proyecto a un repo de GitHub (o usa "Deploy from local
   directory" / Railway CLI).
2. En Railway: **New Project → Deploy from GitHub repo**, selecciona el repo.
3. Railway detecta automáticamente que es un proyecto Node.js (por el
   `package.json`) y usará `npm start` como comando de arranque.
4. En la pestaña **Variables**, agrega una variable por cada bot que quieras
   hostear (así evitas problemas de comillas/escapes con JSON en la UI):
   - `BOT_TOKEN_1` → `token del bot 1`
   - `BOT_TOKEN_2` → `token del bot 2`
   - `BOT_TOKEN_3` → `token del bot 3`
   - ... (agrega tantas `BOT_TOKEN_N` como bots necesites, siempre numeradas
     desde 1 sin saltos)
   - `PREFIX` → `$` (opcional)
5. Deploy. Revisa los **Logs**: deberías ver una línea `✅ Conectado: ...` por
   cada bot que haya iniciado sesión correctamente.

No necesitas ningún `Procfile` ni configuración extra: con `npm start`
Railway ya arranca todos los bots en el mismo proceso.

## Estructura del proyecto

```
discord-multibot/
├── package.json
├── .env.example
├── README.md
└── src/
    ├── index.js          # punto de entrada
    ├── config.js         # lee tokens y prefijo desde variables de entorno
    ├── state.js          # estado en memoria (qué bot está en qué VC y quién lo conectó)
    ├── botManager.js      # crea y loguea cada Client de discord.js
    ├── commands.js        # lógica de $c y $d
    └── voiceHandler.js    # conexión/desconexión de voz + protección anti-robo
```

## Notas importantes

- El estado se guarda **en memoria**, no en una base de datos. Si Railway
  reinicia el proceso (deploy nuevo, crash, etc.), todos los bots quedan
  "idle" de nuevo y hay que reconectarlos con `$c`. Si más adelante quieres
  persistencia (para sobrevivir reinicios), se puede agregar una base de
  datos ligera (SQLite/Redis) — dime y lo agrego.
- El bot no reproduce audio, solo mantiene la conexión de voz activa. Esto es
  suficiente para que aparezca "en línea" dentro del canal indefinidamente.
- Puedes tener tantos bots como quieras en el array `BOTS`; cada uno corre en
  el mismo proceso de Node pero con su propia sesión de Discord.
