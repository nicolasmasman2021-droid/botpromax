'use strict'

const fs = require('fs')
const mineflayer = require('mineflayer')
const {
  pathfinder,
  Movements,
  goals
} = require('mineflayer-pathfinder')

const { GoalNear } = goals

const http = require('http')

const WEB_PORT = Number(process.env.PORT || 3000)

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/plain'
  })

  res.end('Minecraft bot online')
})

server.listen(WEB_PORT, '0.0.0.0', () => {
  console.log(`🌐 Web server escuchando en puerto ${WEB_PORT}`)
})
// =====================================================
// CONFIGURACIÓN
// =====================================================

const HOST = process.env.MC_HOST
const PORT = Number(process.env.MC_PORT || 25565)

const OWNER = 'nicolas7878'
const BOT_USERNAME = 'botpromax'

const PERMISSIONS_FILE = './permissions.json'

const COMMAND_COOLDOWN = 700

let bot = null
let movements = null
let reconnectTimer = null
let manualStop = false
let lastCommandTime = 0

// =====================================================
// PERMISOS
// =====================================================

let allowedUsers = new Map()

function loadPermissions() {
  try {
    if (!fs.existsSync(PERMISSIONS_FILE)) {
      allowedUsers = new Map()
      allowedUsers.set(OWNER.toLowerCase(), OWNER)
      savePermissions()
      return
    }

    const data = fs.readFileSync(
      PERMISSIONS_FILE,
      'utf8'
    )

    const names = JSON.parse(data)

    allowedUsers = new Map()

    if (Array.isArray(names)) {
      for (const name of names) {
        if (typeof name === 'string' && name.trim()) {
          allowedUsers.set(
            name.toLowerCase(),
            name
          )
        }
      }
    }

    // Nico siempre conserva los permisos.
    allowedUsers.set(
      OWNER.toLowerCase(),
      OWNER
    )

    console.log(
      `🔐 Permisos cargados: ${allowedUsers.size}`
    )

  } catch (error) {
    console.log(
      '⚠️ No se pudieron cargar los permisos:',
      error.message
    )

    allowedUsers = new Map()

    allowedUsers.set(
      OWNER.toLowerCase(),
      OWNER
    )
  }
}

function savePermissions() {
  try {
    const names = Array.from(
      allowedUsers.values()
    )

    fs.writeFileSync(
      PERMISSIONS_FILE,
      JSON.stringify(names, null, 2),
      'utf8'
    )

  } catch (error) {
    console.log(
      '⚠️ No se pudieron guardar los permisos:',
      error.message
    )
  }
}

function isOwner(username) {
  return (
    typeof username === 'string' &&
    username.toLowerCase() === OWNER.toLowerCase()
  )
}

function hasPermission(username) {
  if (isOwner(username)) {
    return true
  }

  return allowedUsers.has(
    username.toLowerCase()
  )
}

function addPermission(username) {
  if (!username) {
    return false
  }

  const cleanName = username.trim()

  if (!cleanName) {
    return false
  }

  allowedUsers.set(
    cleanName.toLowerCase(),
    cleanName
  )

  savePermissions()

  return true
}

function removePermission(username) {
  if (!username) {
    return false
  }

  if (isOwner(username)) {
    return false
  }

  const removed = allowedUsers.delete(
    username.toLowerCase()
  )

  savePermissions()

  return removed
}

// =====================================================
// FRASES
// =====================================================

const bromas = [
  'ha sido elegido por el destino... para picar piedra durante 6 horas. 💀',
  'acaba de perder el privilegio de tener suerte.',
  'el comité de Minecraft informa que es sospechoso. 👀',
  'ha sido acusado de robarle comida a los aldeanos. 🧑‍🌾',
  'está bajo investigación de la patrulla de pollos. 🐔',
  'debe 37 diamantes al banco de Minecraft. 💎',
  'fue visto intentando domesticar un creeper. 😭',
  'ha sido elegido presidente de los aldeanos.',
  'ha sido declarado enemigo de los cubos de tierra.',
  'su inventario contiene 3 piedras y cero posibilidades.',
  'intentó negociar con un creeper y perdió.',
  'los aldeanos están discutiendo sobre su caso.',
  'el Consejo de Minecraft tiene preguntas para él.',
  'ha mirado demasiado tiempo a un Enderman.',
  'su nivel de sospecha acaba de subir al 100%.'
]

const sustos = [
  '⚠️ ALERTA: algo está detrás tuyo...',
  '👁️ TE ESTÁN OBSERVANDO',
  '💀 NO MIRES ATRÁS',
  '🚨 SISTEMA DE SEGURIDAD ACTIVADO',
  '👻 ¿Escuchaste eso?',
  '😈 Creo que alguien te está siguiendo...',
  '⚠️ ERROR: jugador demasiado confiado',
  '💀 LA PATATA TE ENCONTRÓ',
  '👁️ No estás solo...',
  '⚠️ ALGO SE MOVIÓ EN LA OSCURIDAD',
  '💀 NO ERA PARTE DEL PLAN',
  '👁️ ¿Por qué miraste hacia atrás?',
  '🚨 SE DETECTÓ UNA PRESENCIA EXTRAÑA',
  '⚠️ DEMASIADO TARDE PARA ESCAPAR'
]

const saludosNico = [
  '📖 La historia continúa... y Nico acaba de entrar en escena.',
  '⚔️ ¡Nico ha llegado! Una nueva aventura está a punto de comenzar.',
  '👑 ¡El destino ha llamado a Nico una vez más!',
  '🔥 ¡Nico está aquí! Ahora sí podemos empezar la aventura.',
  '💎 ¡El héroe de esta historia ha llegado: Nico!',
  '🗿 Nico apareció. Algo me dice que esto va a terminar mal.',
  '🌟 ¡Nico ha entrado al mundo! La aventura puede continuar.',
  '⚔️ Reúnan al equipo. Nico acaba de llegar.',
  '📖 Un nuevo capítulo comienza con la llegada de Nico.',
  '🏆 ¡Nico está aquí! El mundo necesitaba un héroe.',
  '🌌 El destino nos trajo hasta este momento. Bienvenido, Nico.',
  '🔥 La aventura se pone interesante. Nico está en el server.',
  '👁️ Algo grande está por suceder... Nico acaba de llegar.',
  '💀 Nico ha llegado. Esperemos que esta vez tenga un plan.',
  '🧭 El camino está marcado. Nico, la aventura te espera.',
  '⚡ ¡Nico se ha unido a la aventura!',
  '🏰 Los héroes se reúnen. Nico está presente.',
  '📜 La historia acaba de cambiar con la llegada de Nico.',
  '🌟 Bienvenido, Nico. Tu próxima aventura comienza ahora.',
  '🎮 Nico está aquí. Que comience el caos.'
]

const saludosOtros = [
  '¡Hola! 👋',
  '¡Buenas! 😎',
  '¡Bienvenido al server!',
  '¡Miren quién apareció! 👀',
  '¡Llegó la leyenda!',
  '¡Alguien acaba de entrar! 🗿',
  '¡Bienvenido, aventurero!'
]

const monedas = [
  '🪙 Salió CARA',
  '🪙 Salió CRUZ',
  '🪙 La moneda cayó de canto 💀',
  '🪙 La moneda decidió no colaborar 😭'
]

const dados = [
  '🎲 Sacaste un 1. F.',
  '🎲 Sacaste un 2.',
  '🎲 Sacaste un 3.',
  '🎲 Sacaste un 4.',
  '🎲 Sacaste un 5. Casi perfecto.',
  '🎲 ¡Sacaste un 6! 🎉'
]

const storyFrases = [
  '📖 La aventura acaba de comenzar.',
  '⚔️ Algo antiguo ha despertado.',
  '🌎 El destino de este mundo está en nuestras manos.',
  '🔥 No hay vuelta atrás. Tenemos que seguir adelante.',
  '👁️ Esto es mucho más grande de lo que imaginábamos.',
  '🧭 Necesitamos un plan. Y rápido.',
  '📜 La historia todavía no ha terminado.',
  '🌟 Hoy comienza una nueva leyenda.',
  '⚔️ No importa lo que haya delante. Seguimos.',
  '🏆 El mundo necesita héroes.',
  '💀 Esto no estaba en nuestros planes...',
  '🔥 Tenemos una última oportunidad.',
  '👀 Algo me dice que esto va a salir mal.',
  '🛡️ Reúnan al equipo. Tenemos trabajo que hacer.',
  '🌌 El destino nos trajo hasta aquí por alguna razón.',
  '⚔️ Prepárense. La aventura continúa.',
  '🧭 No sé qué hay al otro lado, pero vamos a descubrirlo.',
  '🏰 Esta podría ser nuestra mayor aventura.',
  '🤝 Tenemos que confiar en nuestros amigos.',
  '💀 Bueno... esto definitivamente no estaba previsto.'
]

// =====================================================
// UTILIDADES
// =====================================================

function random(array) {
  if (!Array.isArray(array) || array.length === 0) {
    return ''
  }

  return array[
    Math.floor(Math.random() * array.length)
  ]
}

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

function sendChat(message) {
  if (!bot || !bot.chat) {
    console.log('[CHAT BLOQUEADO]', message)
    return false
  }

  try {
    bot.chat(String(message).slice(0, 250))
    return true
  } catch (error) {
    console.log(
      '❌ Error enviando mensaje:',
      error.message
    )
    return false
  }
}

function findPlayerName(name) {
  if (!bot || !bot.players || !name) {
    return null
  }

  const lower = name.toLowerCase()

  return Object.keys(bot.players).find(
    player =>
      player.toLowerCase() === lower
  ) || null
}

function getPlayerEntity(name) {
  const realName = findPlayerName(name)

  if (!realName) {
    return null
  }

  return bot.players[realName]?.entity || null
}

function commandAllowed(player) {
  if (!hasPermission(player)) {
    console.log(
      `🚫 Comando rechazado: ${player}`
    )
    return false
  }

  const now = Date.now()

  if (
    now - lastCommandTime <
    COMMAND_COOLDOWN
  ) {
    return false
  }

  lastCommandTime = now

  return true
}

// =====================================================
// CREAR BOT
// =====================================================

function createBot() {
  if (manualStop) {
    return
  }

  if (!HOST) {
    console.error(
      '❌ Falta la variable MC_HOST.'
    )
    return
  }

  if (
    !Number.isInteger(PORT) ||
    PORT < 1 ||
    PORT > 65535
  ) {
    console.error(
      '❌ MC_PORT no es válido.'
    )
    return
  }

  console.log('')
  console.log('====================================')
  console.log('🤖 INICIANDO BOT')
  console.log(`🌐 HOST: ${HOST}`)
  console.log(`🔌 PORT: ${PORT}`)
  console.log(`👑 OWNER: ${OWNER}`)
  console.log('====================================')
  console.log('')

  bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: BOT_USERNAME,
    auth: 'offline'
  })

  bot.loadPlugin(pathfinder)

  // ===================================================
  // SPAWN
  // ===================================================

  bot.once('spawn', () => {
    console.log('')
    console.log(
      '✅ BOT CONECTADO CORRECTAMENTE'
    )
    console.log('')

    try {
      movements = new Movements(bot)

      // No rompe bloques mientras se mueve.
      movements.canDig = false

      bot.pathfinder.setMovements(
        movements
      )
    } catch (error) {
      console.log(
        '⚠️ Error configurando movimiento:',
        error.message
      )
    }

    setTimeout(() => {
      sendChat(
        '🤖 Bot conectado. Usá !help'
      )
    }, 1500)
  })

  // ===================================================
  // CHAT
  // ===================================================

  bot.on(
    'chat',
    async (player, message) => {

      try {

        if (player === BOT_USERNAME) {
          return
        }

        if (
          typeof message !== 'string'
        ) {
          return
        }

        const text = message.trim()

        if (!text.startsWith('!')) {
          return
        }

        const args =
          text.split(/\s+/)

        const command =
          args[0].toLowerCase()

        console.log(
          `[COMANDO] ${player}: ${text}`
        )

        // ==========================================
        // HELP
        // ==========================================

        if (command === '!help') {

          sendChat(
            '🤖 !dado !moneda !say !msg !broma !screamer !saludar !story !online !pos !mirar !seguir !parar'
          )

          return
        }

        // ==========================================
        // DAR PERMISO
        // ==========================================

        if (
          command === '!darpermiso'
        ) {

          if (!isOwner(player)) {
            sendChat(
              '❌ Solo nicolas7878 puede dar permisos.'
            )
            return
          }

          if (args.length < 2) {
            sendChat(
              'Uso: !darpermiso <jugador>'
            )
            return
          }

          const target = args[1]

          if (isOwner(target)) {
            sendChat(
              '👑 Nico ya tiene permisos.'
            )
            return
          }

          addPermission(target)

          sendChat(
            `✅ ${target} ahora puede usar los comandos.`
          )

          return
        }

        // ==========================================
        // QUITAR PERMISO
        // ==========================================

        if (
          command === '!quitarpermiso'
        ) {

          if (!isOwner(player)) {
            sendChat(
              '❌ Solo nicolas7878 puede quitar permisos.'
            )
            return
          }

          if (args.length < 2) {
            sendChat(
              'Uso: !quitarpermiso <jugador>'
            )
            return
          }

          const target = args[1]

          if (isOwner(target)) {
            sendChat(
              '❌ No podés quitarle los permisos al dueño.'
            )
            return
          }

          const removed =
            removePermission(target)

          if (removed) {
            sendChat(
              `❌ Permisos de ${target} eliminados.`
            )
          } else {
            sendChat(
              `ℹ️ ${target} no tenía permisos.`
            )
          }

          return
        }

        // ==========================================
        // LISTA DE PERMISOS
        // ==========================================

        if (
          command === '!permisos'
        ) {

          if (!isOwner(player)) {
            sendChat(
              '❌ Solo nicolas7878 puede ver los permisos.'
            )
            return
          }

          const names =
            Array.from(
              allowedUsers.values()
            )

          sendChat(
            `👑 Autorizados: ${names.join(', ')}`
          )

          return
        }

        // ==========================================
        // RECONEXIÓN
        // ==========================================

        if (
          command === '!reconectar'
        ) {

          if (!isOwner(player)) {
            sendChat(
              '❌ Solo Nico puede reconectar el bot.'
            )
            return
          }

          sendChat(
            '🔄 Reconectando...'
          )

          setTimeout(() => {
            try {
              if (bot) {
                bot.quit(
                  'Reconexión solicitada'
                )
              }
            } catch (error) {
              console.log(
                'Error reconectando:',
                error.message
              )
            }
          }, 1000)

          return
        }

        // ==========================================
        // PERMISO NORMAL
        // ==========================================

        if (!commandAllowed(player)) {
          return
        }

        // ==========================================
        // DADO
        // ==========================================

        if (command === '!dado') {
          sendChat(random(dados))
          return
        }

        // ==========================================
        // MONEDA
        // ==========================================

        if (command === '!moneda') {
          sendChat(random(monedas))
          return
        }

        // ==========================================
        // SAY
        // ==========================================

        if (command === '!say') {

          if (args.length < 2) {
            sendChat(
              'Uso: !say <mensaje>'
            )
            return
          }

          sendChat(
            args.slice(1).join(' ')
          )

          return
        }

        // ==========================================
        // MSG
        // ==========================================

        if (command === '!msg') {

          if (args.length < 3) {
            sendChat(
              'Uso: !msg <jugador> <mensaje>'
            )
            return
          }

          const target = args[1]

          const privateMessage =
            args.slice(2).join(' ')

          sendChat(
            `/msg ${target} ${privateMessage}`
          )

          return
        }

        // ==========================================
        // BROMA
        // ==========================================

        if (command === '!broma') {

          if (args.length < 2) {
            sendChat(
              'Uso: !broma <jugador>'
            )
            return
          }

          const target = args[1]

          sendChat(
            `😂 ${target} ${random(bromas)}`
          )

          return
        }

        // ==========================================
        // SCREAMER
        // ==========================================

        if (command === '!screamer') {

          if (args.length < 2) {
            sendChat(
              'Uso: !screamer <jugador>'
            )
            return
          }

          const target = args[1]

          if (!findPlayerName(target)) {
            sendChat(
              `❌ No encuentro a ${target}.`
            )
            return
          }

          sendChat(
            `⚠️ ${target}: ${random(sustos)}`
          )

          await sleep(1200)

          if (!bot) return

          sendChat(
            `👁️ ${target}...`
          )

          await sleep(1300)

          if (!bot) return

          sendChat(
            `💀 ${random(sustos)}`
          )

          return
        }

        // ==========================================
        // SALUDAR
        // ==========================================

        if (command === '!saludar') {

          if (args.length < 2) {
            sendChat(
              'Uso: !saludar <jugador>'
            )
            return
          }

          const target = args[1]

          if (
            target.toLowerCase() === 'nico'
          ) {
            sendChat(
              random(saludosNico)
            )
          } else {
            sendChat(
              `${target}: ${random(saludosOtros)}`
            )
          }

          return
        }

        // ==========================================
        // STORY
        // ==========================================

        if (command === '!story') {
          sendChat(
            random(storyFrases)
          )
          return
        }

        // ==========================================
        // ONLINE
        // ==========================================

        if (command === '!online') {

          const players =
            Object.keys(bot.players || {})

          if (players.length === 0) {
            sendChat(
              '👻 No veo jugadores.'
            )
          } else {
            sendChat(
              `👥 Jugadores: ${players.join(', ')}`
            )
          }

          return
        }

        // ==========================================
        // POSICIÓN
        // ==========================================

        if (command === '!pos') {

          if (
            !bot.entity ||
            !bot.entity.position
          ) {
            sendChat(
              '❌ Todavía no tengo posición.'
            )
            return
          }

          const p =
            bot.entity.position

          sendChat(
            `📍 X:${Math.floor(p.x)} Y:${Math.floor(p.y)} Z:${Math.floor(p.z)}`
          )

          return
        }

        // ==========================================
        // MIRAR
        // ==========================================

        if (command === '!mirar') {

          if (args.length < 2) {
            sendChat(
              'Uso: !mirar <jugador>'
            )
            return
          }

          const target = args[1]

          const entity =
            getPlayerEntity(target)

          if (!entity) {
            sendChat(
              `❌ No encuentro a ${target}.`
            )
            return
          }

          try {

            await bot.lookAt(
              entity.position.offset(
                0,
                1.6,
                0
              ),
              true
            )

            sendChat(
              `👁️ Estoy mirando a ${target}.`
            )

          } catch (error) {

            console.log(
              'Error mirando:',
              error.message
            )

            sendChat(
              '❌ No pude mirar hacia ese jugador.'
            )
          }

          return
        }

        // ==========================================
        // SEGUIR
        // ==========================================

        if (command === '!seguir') {

          if (args.length < 2) {
            sendChat(
              'Uso: !seguir <jugador>'
            )
            return
          }

          const target = args[1]

          const entity =
            getPlayerEntity(target)

          if (!entity) {
            sendChat(
              `❌ No encuentro a ${target}.`
            )
            return
          }

          if (!movements) {
            sendChat(
              '❌ El movimiento todavía no está listo.'
            )
            return
          }

          try {

            bot.pathfinder.setMovements(
              movements
            )

            const p =
              entity.position

            bot.pathfinder.setGoal(
              new GoalNear(
                p.x,
                p.y,
                p.z,
                2
              ),
              true
            )

            sendChat(
              `👀 Voy hacia ${target}.`
            )

          } catch (error) {

            console.log(
              'Error siguiendo:',
              error.message
            )

            sendChat(
              '❌ No pude empezar a seguirlo.'
            )
          }

          return
        }

        // ==========================================
        // PARAR
        // ==========================================

        if (command === '!parar') {

          try {

            if (bot.pathfinder) {
              bot.pathfinder.setGoal(null)
            }

          } catch (error) {

            console.log(
              'Error deteniendo movimiento:',
              error.message
            )
          }

          sendChat(
            '🛑 Me quedo quieto.'
          )

          return
        }

        // ==========================================
        // DESCONOCIDO
        // ==========================================

        sendChat(
          `❓ Comando desconocido: ${command}. Usá !help`
        )

      } catch (error) {

        console.log(
          '❌ Error procesando comando:',
          error
        )
      }
    }
  )

  // ===================================================
  // LOGIN
  // ===================================================

  bot.on('login', () => {
    console.log('🔐 Login realizado.')
  })

  // ===================================================
  // ERROR
  // ===================================================

  bot.on('error', error => {

    console.log('')
    console.log('❌ ERROR DEL BOT')
    console.log(
      error?.message || error
    )
    console.log('')
  })

  // ===================================================
  // KICK
  // ===================================================

  bot.on('kicked', reason => {

    console.log('')
    console.log('🚫 BOT EXPULSADO')
    console.log(
      'Motivo:',
      reason
    )
    console.log('')
  })

  // ===================================================
  // DESCONEXIÓN
  // ===================================================

  bot.on('end', reason => {

    console.log('')
    console.log('🔌 BOT DESCONECTADO')
    console.log(
      'Motivo:',
      reason || 'desconocido'
    )
    console.log('')

    bot = null
    movements = null

    if (manualStop) {
      return
    }

    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
    }

    console.log(
      '🔄 Reconectando en 10 segundos...'
    )

    reconnectTimer = setTimeout(() => {

      reconnectTimer = null

      createBot()

    }, 10000)
  })
}

// =====================================================
// INICIO
// =====================================================

loadPermissions()

if (!HOST) {

  console.error('')
  console.error(
    '❌ MC_HOST no está configurado.'
  )
  console.error('')
  console.error(
    'Configurá MC_HOST y MC_PORT en las variables de entorno.'
  )
  console.error('')

} else {

  createBot()
}

// =====================================================
// CIERRE SEGURO
// =====================================================

function shutdown(signal) {

  console.log(
    `\n🛑 Recibido ${signal}. Cerrando...`
  )

  manualStop = true

  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  try {

    if (bot) {
      bot.quit(
        'Bot apagado'
      )
    }

  } catch (error) {

    console.log(
      'Error cerrando:',
      error.message
    )
  }

  setTimeout(() => {
    process.exit(0)
  }, 1000)
}

process.on(
  'SIGINT',
  () => shutdown('SIGINT')
)

process.on(
  'SIGTERM',
  () => shutdown('SIGTERM')
)
