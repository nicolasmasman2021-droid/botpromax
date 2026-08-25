'use strict'

const fs = require('fs')
const http = require('http')
const mineflayer = require('mineflayer')
const {
  pathfinder,
  Movements,
  goals: { GoalNear }
} = require('mineflayer-pathfinder')

// =====================================================
// CONFIGURACIÓN
// =====================================================

const CONFIG = {
  host: process.env.MC_HOST || 'trolos1.aternos.me',
  port: Number(process.env.MC_PORT || 25565),
  username: process.env.BOT_USERNAME || 'botpromax',
  // BOT_PASSWORD tiene prioridad. El valor de respaldo sirve si Render no la carga.
  pluginPassword: process.env.BOT_PASSWORD || '123456',
  owner: (process.env.OWNER || 'nicolas7878').toLowerCase(),
  version: process.env.MC_VERSION || false,
  reconnectMs: Number(process.env.RECONNECT_MS || 10000),
  connectTimeoutMs: Number(process.env.CONNECT_TIMEOUT_MS || 25000),
  webPort: Number(process.env.PORT || 10000)
}

const PERMISSIONS_FILE = './permissions.json'
const COMMAND_COOLDOWN = 700

let bot = null
let movements = null
let reconnectTimer = null
let connectWatchdog = null
let manualStop = false
let connected = false
let loginSent = false
let lastCommandTime = 0
let taskId = 0
let mode = 'quieto'
let connectionId = 0
let allowedUsers = new Map()

// =====================================================
// FRASES ORIGINALES
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
  '⚠️ ALERTA: algo está detrás tuyo...', '👁️ TE ESTÁN OBSERVANDO',
  '💀 NO MIRES ATRÁS', '🚨 SISTEMA DE SEGURIDAD ACTIVADO',
  '👻 ¿Escuchaste eso?', '😈 Creo que alguien te está siguiendo...',
  '⚠️ ERROR: jugador demasiado confiado', '💀 LA PATATA TE ENCONTRÓ',
  '👁️ No estás solo...', '⚠️ ALGO SE MOVIÓ EN LA OSCURIDAD',
  '💀 NO ERA PARTE DEL PLAN', '👁️ ¿Por qué miraste hacia atrás?',
  '🚨 SE DETECTÓ UNA PRESENCIA EXTRAÑA', '⚠️ DEMASIADO TARDE PARA ESCAPAR'
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
  '¡Hola! 👋', '¡Buenas! 😎', '¡Bienvenido al server!',
  '¡Miren quién apareció! 👀', '¡Llegó la leyenda!',
  '¡Alguien acaba de entrar! 🗿', '¡Bienvenido, aventurero!'
]

const monedas = [
  '🪙 Salió CARA', '🪙 Salió CRUZ',
  '🪙 La moneda cayó de canto 💀', '🪙 La moneda decidió no colaborar 😭'
]

const dados = [
  '🎲 Sacaste un 1. F.', '🎲 Sacaste un 2.', '🎲 Sacaste un 3.',
  '🎲 Sacaste un 4.', '🎲 Sacaste un 5. Casi perfecto.',
  '🎲 ¡Sacaste un 6! 🎉'
]

const storyFrases = [
  '📖 La aventura acaba de comenzar.', '⚔️ Algo antiguo ha despertado.',
  '🌎 El destino de este mundo está en nuestras manos.',
  '🔥 No hay vuelta atrás. Tenemos que seguir adelante.',
  '👁️ Esto es mucho más grande de lo que imaginábamos.',
  '🧭 Necesitamos un plan. Y rápido.', '📜 La historia todavía no ha terminado.',
  '🌟 Hoy comienza una nueva leyenda.', '⚔️ No importa lo que haya delante. Seguimos.',
  '🏆 El mundo necesita héroes.', '💀 Esto no estaba en nuestros planes...',
  '🔥 Tenemos una última oportunidad.', '👀 Algo me dice que esto va a salir mal.',
  '🛡️ Reúnan al equipo. Tenemos trabajo que hacer.',
  '🌌 El destino nos trajo hasta aquí por alguna razón.',
  '⚔️ Prepárense. La aventura continúa.',
  '🧭 No sé qué hay al otro lado, pero vamos a descubrirlo.',
  '🏰 Esta podría ser nuestra mayor aventura.',
  '🤝 Tenemos que confiar en nuestros amigos.',
  '💀 Bueno... esto definitivamente no estaba previsto.'
]

// =====================================================
// UTILIDADES Y PERMISOS
// =====================================================

function log(message) { console.log(`[${new Date().toLocaleTimeString()}] ${message}`) }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }
function normalize(value) { return String(value || '').trim().toLowerCase() }
function random(array) { return array[Math.floor(Math.random() * array.length)] }

function loadPermissions() {
  allowedUsers = new Map()
  try {
    if (fs.existsSync(PERMISSIONS_FILE)) {
      const names = JSON.parse(fs.readFileSync(PERMISSIONS_FILE, 'utf8'))
      if (Array.isArray(names)) {
        for (const name of names) {
          if (typeof name === 'string' && name.trim()) allowedUsers.set(normalize(name), name.trim())
        }
      }
    }
  } catch (error) {
    log(`No se pudieron cargar permisos: ${error.message}`)
  }
  allowedUsers.set(CONFIG.owner, CONFIG.owner)
  savePermissions()
  log(`Permisos cargados: ${allowedUsers.size}`)
}

function savePermissions() {
  try {
    fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify([...allowedUsers.values()], null, 2), 'utf8')
  } catch (error) {
    log(`No se pudieron guardar permisos: ${error.message}`)
  }
}

function isOwner(username) { return normalize(username) === CONFIG.owner }
function hasPermission(username) { return isOwner(username) || allowedUsers.has(normalize(username)) }

function commandAllowed(username) {
  if (!hasPermission(username)) return false
  const now = Date.now()
  if (now - lastCommandTime < COMMAND_COOLDOWN) return false
  lastCommandTime = now
  return true
}

function sendChat(message) {
  if (!bot?.player || !connected) return false
  try {
    bot.chat(String(message).slice(0, 250))
    return true
  } catch (error) {
    log(`Error enviando chat: ${error.message}`)
    return false
  }
}

function getPlayerEntity(name) {
  if (!bot) return null
  const player = Object.values(bot.players).find(item => normalize(item.username) === normalize(name))
  return player?.entity || null
}

function distanceTo(entity) {
  if (!bot?.entity?.position || !entity?.position) return Infinity
  return bot.entity.position.distanceTo(entity.position)
}

function setGoalNear(entity, range = 2) {
  if (!bot?.pathfinder || !entity?.position) return
  bot.pathfinder.setGoal(new GoalNear(
    Math.floor(entity.position.x), Math.floor(entity.position.y), Math.floor(entity.position.z), range
  ))
}

function stopAll(reason = 'Tarea detenida.') {
  taskId++
  mode = 'quieto'
  try {
    bot?.pathfinder?.setGoal(null)
    bot?.clearControlStates()
  } catch (_) {}
  log(reason)
}

function isHostileMob(entity) {
  const hostiles = new Set([
    'blaze', 'bogged', 'breeze', 'cave_spider', 'creeper', 'drowned', 'elder_guardian',
    'endermite', 'evoker', 'ghast', 'guardian', 'hoglin', 'husk', 'magma_cube',
    'phantom', 'piglin', 'piglin_brute', 'pillager', 'ravager', 'shulker', 'silverfish',
    'skeleton', 'slime', 'spider', 'stray', 'vex', 'vindicator', 'warden', 'witch',
    'wither_skeleton', 'zoglin', 'zombie', 'zombie_villager', 'zombified_piglin'
  ])
  return entity?.type === 'mob' && hostiles.has(normalize(entity.name))
}

function nearestHostile(range = 16, around = bot?.entity) {
  if (!bot || !around?.position) return null
  return bot.nearestEntity(entity => isHostileMob(entity) && around.position.distanceTo(entity.position) <= range)
}

// =====================================================
// LOGIN, MOVIMIENTO, MINERÍA Y COMBATE
// =====================================================

function sendPluginLogin() {
  if (loginSent || !connected || !CONFIG.pluginPassword) return
  loginSent = true
  sendChat(`/login ${CONFIG.pluginPassword}`)
  log('Comando /login enviado.')
}

async function followPlayer(name) {
  const id = ++taskId
  mode = `siguiendo a ${name}`
  sendChat(`👀 Voy hacia ${name}.`)
  while (taskId === id && connected) {
    const target = getPlayerEntity(name)
    if (target) setGoalNear(target, 2)
    else sendChat(`❌ No encuentro a ${name}.`)
    await sleep(1200)
  }
}

async function protectOwner() {
  const id = ++taskId
  mode = `protegiendo a ${CONFIG.owner}`
  sendChat(`🛡️ Protegiendo a ${CONFIG.owner}.`)
  while (taskId === id && connected) {
    const owner = getPlayerEntity(CONFIG.owner)
    const enemy = owner ? nearestHostile(14, owner) : null
    if (enemy && distanceTo(enemy) <= 3.2) {
      bot.pathfinder.setGoal(null)
      try { await bot.lookAt(enemy.position.offset(0, enemy.height || 1, 0), true); bot.attack(enemy) } catch (_) {}
    } else if (enemy) setGoalNear(enemy, 2)
    else if (owner) setGoalNear(owner, 3)
    await sleep(650)
  }
}

async function fightMobs(seconds) {
  const id = ++taskId
  const endAt = Date.now() + seconds * 1000
  mode = 'combatiendo mobs'
  sendChat(`⚔️ Atacando mobs durante ${seconds} segundos.`)
  while (taskId === id && connected && Date.now() < endAt) {
    const enemy = nearestHostile(32)
    if (!enemy) { await sleep(900); continue }
    if (distanceTo(enemy) > 3.2) setGoalNear(enemy, 2)
    else {
      bot.pathfinder.setGoal(null)
      try { await bot.lookAt(enemy.position.offset(0, enemy.height || 1, 0), true); bot.attack(enemy) } catch (_) {}
    }
    await sleep(650)
  }
  if (taskId === id) stopAll()
}

async function fightPlayer(name, seconds) {
  const target = getPlayerEntity(name)
  if (!target) return sendChat(`❌ No encuentro a ${name}.`)
  const id = ++taskId
  const endAt = Date.now() + seconds * 1000
  mode = `combatiendo a ${name}`
  sendChat(`⚔️ Peleando contra ${name} durante ${seconds} segundos.`)
  while (taskId === id && connected && target.isValid && Date.now() < endAt) {
    if (distanceTo(target) > 3.2) setGoalNear(target, 2)
    else {
      bot.pathfinder.setGoal(null)
      try { await bot.lookAt(target.position.offset(0, target.height || 1, 0), true); bot.attack(target) } catch (_) {}
    }
    await sleep(650)
  }
  if (taskId === id) stopAll()
}

function blockIdsFor(material) {
  const blocks = {
    diamante: ['diamond_ore', 'deepslate_diamond_ore'], diamond: ['diamond_ore', 'deepslate_diamond_ore'],
    hierro: ['iron_ore', 'deepslate_iron_ore'], iron: ['iron_ore', 'deepslate_iron_ore'],
    oro: ['gold_ore', 'deepslate_gold_ore', 'nether_gold_ore'], gold: ['gold_ore', 'deepslate_gold_ore', 'nether_gold_ore'],
    carbon: ['coal_ore', 'deepslate_coal_ore'], coal: ['coal_ore', 'deepslate_coal_ore'],
    redstone: ['redstone_ore', 'deepslate_redstone_ore'],
    lapis: ['lapis_ore', 'deepslate_lapis_ore'],
    esmeralda: ['emerald_ore', 'deepslate_emerald_ore'], emerald: ['emerald_ore', 'deepslate_emerald_ore']
  }
  return (blocks[normalize(material)] || []).map(name => bot.registry.blocksByName[name]?.id).filter(Number.isInteger)
}

async function mine(material, quantity) {
  const ids = blockIdsFor(material)
  if (!ids.length) return sendChat('Uso: !minar diamante 5')
  const id = ++taskId
  const wanted = Math.max(1, Math.min(Number(quantity) || 1, 64))
  let mined = 0
  mode = `minando ${material}`
  sendChat(`⛏️ Buscando ${wanted} bloque(s) de ${material}.`)
  while (taskId === id && connected && mined < wanted) {
    const block = bot.findBlock({ matching: ids, maxDistance: 48 })
    if (!block) break
    try {
      await bot.pathfinder.goto(new GoalNear(block.position.x, block.position.y, block.position.z, 1))
      const current = bot.blockAt(block.position)
      if (current && ids.includes(current.type) && bot.canDigBlock(current)) { await bot.dig(current); mined++ }
    } catch (error) { log(`No pude minar: ${error.message}`) }
    await sleep(300)
  }
  if (taskId === id) { sendChat(`⛏️ Minería terminada: ${mined}/${wanted}.`); stopAll() }
}

function inventoryText() {
  const totals = new Map()
  for (const item of bot.inventory.items()) totals.set(item.displayName, (totals.get(item.displayName) || 0) + item.count)
  const text = [...totals.entries()].map(([name, count]) => `${name} x${count}`).join(', ') || 'Inventario vacío.'
  return text.slice(0, 250)
}

// =====================================================
// COMANDOS: ORIGINALES + NUEVOS
// =====================================================

async function handleCommand(player, message) {
  if (normalize(player) === normalize(CONFIG.username) || typeof message !== 'string') return
  const text = message.trim()
  if (!text.startsWith('!')) return
  const args = text.split(/\s+/)
  const command = normalize(args.shift())
  log(`Comando ${player}: ${text}`)

  // Estos comandos no necesitan permiso, igual que en el código original.
  if (command === '!help') {
    return sendChat('🤖 !dado !moneda !say !msg !broma !screamer !saludar !story !online !pos !mirar !seguir !parar !proteger !desproteger !minar !pelear !status !inventario')
  }

  if (command === '!darpermiso' || command === '!quitarpermiso' || command === '!permisos' || command === '!reconectar') {
    if (!isOwner(player)) return sendChat('❌ Solo nicolas7878 puede usar ese comando.')
    if (command === '!darpermiso') {
      if (!args[0]) return sendChat('Uso: !darpermiso <jugador>')
      allowedUsers.set(normalize(args[0]), args[0]); savePermissions()
      return sendChat(`✅ ${args[0]} ahora puede usar los comandos.`)
    }
    if (command === '!quitarpermiso') {
      if (!args[0]) return sendChat('Uso: !quitarpermiso <jugador>')
      if (isOwner(args[0])) return sendChat('❌ No podés quitar permisos al dueño.')
      const removed = allowedUsers.delete(normalize(args[0])); savePermissions()
      return sendChat(removed ? `❌ Permisos de ${args[0]} eliminados.` : `ℹ️ ${args[0]} no tenía permisos.`)
    }
    if (command === '!permisos') return sendChat(`👑 Autorizados: ${[...allowedUsers.values()].join(', ')}`)
    sendChat('🔄 Reconectando...')
    return setTimeout(() => bot?.quit('Reconexión solicitada'), 800)
  }

  if (!commandAllowed(player)) return

  if (command === '!dado') return sendChat(random(dados))
  if (command === '!moneda') return sendChat(random(monedas))
  if (command === '!say') return args.length ? sendChat(args.join(' ')) : sendChat('Uso: !say <mensaje>')
  if (command === '!msg') return args.length >= 2 ? sendChat(`/msg ${args[0]} ${args.slice(1).join(' ')}`) : sendChat('Uso: !msg <jugador> <mensaje>')
  if (command === '!broma') return args[0] ? sendChat(`😂 ${args[0]} ${random(bromas)}`) : sendChat('Uso: !broma <jugador>')
  if (command === '!story') return sendChat(random(storyFrases))
  if (command === '!online') return sendChat(`👥 Jugadores: ${Object.keys(bot.players).join(', ') || 'ninguno'}`)
  if (command === '!inventario' || command === '!inv') return sendChat(inventoryText())
  if (command === '!status') {
    const p = bot.entity.position.floored()
    return sendChat(`📊 ${mode} | Vida ${bot.health}/20 | Comida ${bot.food}/20 | X:${p.x} Y:${p.y} Z:${p.z}`)
  }
  if (command === '!pos') {
    const p = bot.entity.position.floored()
    return sendChat(`📍 X:${p.x} Y:${p.y} Z:${p.z}`)
  }
  if (command === '!saludar') {
    if (!args[0]) return sendChat('Uso: !saludar <jugador>')
    return sendChat(['nico', CONFIG.owner].includes(normalize(args[0])) ? random(saludosNico) : `${args[0]}: ${random(saludosOtros)}`)
  }
  if (command === '!screamer') {
    if (!args[0] || !getPlayerEntity(args[0])) return sendChat('Uso: !screamer <jugador visible>')
    sendChat(`⚠️ ${args[0]}: ${random(sustos)}`)
    await sleep(1200); if (connected) sendChat(`👁️ ${args[0]}...`)
    await sleep(1300); if (connected) sendChat(`💀 ${random(sustos)}`)
    return
  }
  if (command === '!mirar') {
    const target = getPlayerEntity(args[0])
    if (!target) return sendChat('Uso: !mirar <jugador visible>')
    try { await bot.lookAt(target.position.offset(0, 1.6, 0), true); return sendChat(`👁️ Estoy mirando a ${args[0]}.`) } catch (_) { return sendChat('❌ No pude mirar hacia ese jugador.') }
  }
  if (command === '!seguir') {
    if (!args[0]) return sendChat('Uso: !seguir <jugador>')
    if (!getPlayerEntity(args[0])) return sendChat(`❌ No encuentro a ${args[0]}.`)
    stopAll(); followPlayer(args[0]); return
  }
  if (command === '!parar') { stopAll(); return sendChat('🛑 Me quedo quieto.') }
  if (command === '!proteger') { stopAll(); protectOwner(); return }
  if (command === '!desproteger') { stopAll(); return sendChat('🛡️ Protección desactivada.') }
  if (command === '!minar') { stopAll(); return mine(args[0], args[1]) }
  if (command === '!pelear') {
    const type = normalize(args[0]); const seconds = Math.max(5, Math.min(Number(args.at(-1)) || 30, 300))
    stopAll()
    if (type === 'mobs' || type === 'mob') return fightMobs(seconds)
    if ((type === 'jugador' || type === 'player') && args[1] && !/^\d+$/.test(args[1])) return fightPlayer(args[1], seconds)
    return sendChat('Uso: !pelear mobs 60 o !pelear jugador Nombre 30')
  }

  sendChat(`❓ Comando desconocido: ${command}. Usá !help`)
}

// =====================================================
// CONEXIÓN, REINTENTOS Y RENDER
// =====================================================

function clearWatchdog() {
  if (connectWatchdog) clearTimeout(connectWatchdog)
  connectWatchdog = null
}

function scheduleReconnect() {
  if (manualStop || reconnectTimer) return
  reconnectTimer = setTimeout(() => { reconnectTimer = null; createBot() }, CONFIG.reconnectMs)
  log(`Reconectando en ${CONFIG.reconnectMs / 1000} segundos...`)
}

function createBot() {
  if (manualStop) return
  if (!CONFIG.host || !Number.isInteger(CONFIG.port) || CONFIG.port < 1 || CONFIG.port > 65535) {
    return log('MC_HOST o MC_PORT no son válidos.')
  }

  const id = ++connectionId
  connected = false
  loginSent = false
  clearWatchdog()
  stopAll('Iniciando conexión...')
  log(`Conectando a ${CONFIG.host}:${CONFIG.port} como ${CONFIG.username}`)

  const currentBot = mineflayer.createBot({
    host: CONFIG.host,
    port: CONFIG.port,
    username: CONFIG.username,
    auth: 'offline',
    version: CONFIG.version,
    connectTimeout: CONFIG.connectTimeoutMs,
    checkTimeoutInterval: 60000,
    hideErrors: true
  })

  bot = currentBot
  bot.loadPlugin(pathfinder)

  connectWatchdog = setTimeout(() => {
    if (id !== connectionId || connected) return
    log(`Aternos no respondió en ${CONFIG.connectTimeoutMs / 1000} segundos.`)
    log('Verificá que esté Online y que trolos1.aternos.me:24474 sea la dirección exacta de Aternos.')
    try { currentBot.quit('Tiempo de espera agotado') } catch (_) { scheduleReconnect() }
  }, CONFIG.connectTimeoutMs)

  bot.once('login', () => log('Login de Minecraft aceptado; esperando spawn...'))

  bot.once('spawn', () => {
    if (id !== connectionId) return
    clearWatchdog()
    connected = true
    movements = new Movements(bot)
    movements.canDig = true
    movements.allow1by1towers = false
    bot.pathfinder.setMovements(movements)
    log('BOT CONECTADO CORRECTAMENTE')
    setTimeout(sendPluginLogin, 1500)
    setTimeout(() => sendChat('🤖 Bot conectado. Usá !help'), 2800)
  })

  bot.on('chat', handleCommand)
  bot.on('messagestr', message => {
    const text = normalize(message)
    if (text.includes('/login') || text.includes('inicia sesión') || text.includes('inicie sesión') || text.includes('log in')) sendPluginLogin()
  })
  bot.on('error', error => log(`Error de Minecraft: ${error?.message || error}`))
  bot.on('kicked', reason => log(`Bot expulsado: ${typeof reason === 'string' ? reason : JSON.stringify(reason)}`))
  bot.on('end', reason => {
    if (id !== connectionId) return
    clearWatchdog()
    connected = false
    bot = null
    movements = null
    log(`Bot desconectado: ${reason || 'sin detalle'}`)
    scheduleReconnect()
  })
}

const webServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({ ok: true, minecraftConnected: connected, mode, server: `${CONFIG.host}:${CONFIG.port}` }))
})

webServer.listen(CONFIG.webPort, '0.0.0.0', () => log(`Servidor web activo en puerto ${CONFIG.webPort}`))

function shutdown(signal) {
  log(`${signal}: cerrando bot.`)
  manualStop = true
  clearWatchdog()
  if (reconnectTimer) clearTimeout(reconnectTimer)
  try { bot?.quit('Bot apagado') } catch (_) {}
  webServer.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 1500)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('uncaughtException', error => { log(`Error inesperado: ${error.message}`); scheduleReconnect() })
process.on('unhandledRejection', error => log(`Promesa rechazada: ${error?.message || error}`))

loadPermissions()
createBot()
