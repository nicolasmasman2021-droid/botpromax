'use strict'

const mineflayer = require('mineflayer')
const {
  pathfinder,
  Movements,
  goals: { GoalNear }
} = require('mineflayer-pathfinder')

// Configuración: puedes cambiar estos valores desde variables de entorno.
const CONFIG = {
  host: process.env.MC_HOST || 'trolos1.aternos.me',
  port: Number(process.env.MC_PORT || 25565),
  username: process.env.BOT_USERNAME || 'botpromax',
  pluginPassword: process.env.BOT_PASSWORD || '123456',
  owner: (process.env.OWNER || 'nicolas7878').toLowerCase(),
  reconnectMs: Number(process.env.RECONNECT_MS || 10000)
}

let bot = null
let movements = null
let reconnectTimer = null
let loginSent = false
let taskId = 0
let mode = 'quieto'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function log(message) {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`)
}

function normalize(text) {
  return String(text || '').toLowerCase()
}

function isOwner(username) {
  return normalize(username) === CONFIG.owner
}

function distanceTo(entity) {
  if (!bot?.entity?.position || !entity?.position) return Infinity
  return bot.entity.position.distanceTo(entity.position)
}

function isMob(entity) {
  return entity && entity.type === 'mob'
}

function stopAll(reason = 'Detenido.') {
  taskId++
  mode = 'quieto'

  if (bot?.pathfinder) {
    bot.pathfinder.setGoal(null)
  }

  if (bot) {
    bot.clearControlStates()
  }

  log(reason)
}

function say(message) {
  if (bot && bot.player) bot.chat(message)
}

function ownerEntity() {
  return bot.players[CONFIG.owner]?.entity || null
}

function playerEntity(name) {
  return bot.players[normalize(name)]?.entity || null
}

function nearestHostile(range = 16, around = bot?.entity) {
  if (!bot || !around?.position) return null

  return bot.nearestEntity(entity =>
    isMob(entity) &&
    entity.position &&
    around.position.distanceTo(entity.position) <= range
  )
}

async function followPlayer(name) {
  const currentTask = ++taskId
  mode = `siguiendo a ${name}`

  say(`Siguiendo a ${name}. Usa !parar para detenerme.`)

  while (taskId === currentTask && bot?.player) {
    const target = playerEntity(name)

    if (!target) {
      say(`No veo a ${name}.`)
      break
    }

    bot.pathfinder.setGoal(
      new GoalNear(
        Math.floor(target.position.x),
        Math.floor(target.position.y),
        Math.floor(target.position.z),
        2
      )
    )

    await sleep(1000)
  }

  if (taskId === currentTask) stopAll()
}

async function protectOwner() {
  const currentTask = ++taskId
  mode = `protegiendo a ${CONFIG.owner}`

  say(`Protegiendo a ${CONFIG.owner}.`)

  while (taskId === currentTask && bot?.player) {
    const owner = ownerEntity()

    if (!owner) {
      say(`No veo a ${CONFIG.owner}; espero a que se acerque.`)
      bot.pathfinder.setGoal(null)
      await sleep(1500)
      continue
    }

    const enemy = nearestHostile(12, owner)

    if (enemy) {
      const distance = distanceTo(enemy)

      if (distance > 3.2) {
        bot.pathfinder.setGoal(
          new GoalNear(
            Math.floor(enemy.position.x),
            Math.floor(enemy.position.y),
            Math.floor(enemy.position.z),
            2
          )
        )
      } else {
        bot.pathfinder.setGoal(null)
        try {
          await bot.lookAt(enemy.position.offset(0, enemy.height || 1, 0), true)
          bot.attack(enemy)
        } catch (_) {}
      }
    } else {
      bot.pathfinder.setGoal(
        new GoalNear(
          Math.floor(owner.position.x),
          Math.floor(owner.position.y),
          Math.floor(owner.position.z),
          3
        )
      )
    }

    await sleep(650)
  }

  if (taskId === currentTask) stopAll()
}

async function attackTarget(target, seconds, label) {
  const currentTask = ++taskId
  const endAt = Date.now() + seconds * 1000
  mode = `combatiendo ${label}`

  say(`Combatiendo ${label} durante ${seconds} segundos.`)

  while (taskId === currentTask && bot?.player && Date.now() < endAt) {
    if (!target?.isValid) break

    const distance = distanceTo(target)

    if (distance > 3.2) {
      bot.pathfinder.setGoal(
        new GoalNear(
          Math.floor(target.position.x),
          Math.floor(target.position.y),
          Math.floor(target.position.z),
          2
        )
      )
    } else {
      bot.pathfinder.setGoal(null)

      try {
        await bot.lookAt(target.position.offset(0, target.height || 1, 0), true)
        bot.attack(target)
      } catch (_) {}
    }

    await sleep(650)
  }

  if (taskId === currentTask) {
    say('Combate terminado.')
    stopAll()
  }
}

function getBlockIds(material) {
  const aliases = {
    diamante: ['diamond_ore', 'deepslate_diamond_ore'],
    diamond: ['diamond_ore', 'deepslate_diamond_ore'],
    hierro: ['iron_ore', 'deepslate_iron_ore'],
    iron: ['iron_ore', 'deepslate_iron_ore'],
    oro: ['gold_ore', 'deepslate_gold_ore', 'nether_gold_ore'],
    gold: ['gold_ore', 'deepslate_gold_ore', 'nether_gold_ore'],
    carbon: ['coal_ore', 'deepslate_coal_ore'],
    coal: ['coal_ore', 'deepslate_coal_ore'],
    redstone: ['redstone_ore', 'deepslate_redstone_ore'],
    lapislazuli: ['lapis_ore', 'deepslate_lapis_ore'],
    lapis: ['lapis_ore', 'deepslate_lapis_ore'],
    esmeralda: ['emerald_ore', 'deepslate_emerald_ore'],
    emerald: ['emerald_ore', 'deepslate_emerald_ore']
  }

  const names = aliases[normalize(material)]
  if (!names) return []

  return names
    .map(name => bot.registry.blocksByName[name]?.id)
    .filter(id => id !== undefined)
}

async function mine(material, amount) {
  const ids = getBlockIds(material)

  if (ids.length === 0) {
    say('Material no válido. Ejemplo: !minar diamante 5')
    return
  }

  const currentTask = ++taskId
  const targetAmount = Math.max(1, Math.min(Number(amount) || 1, 64))
  let mined = 0
  mode = `minando ${material}`

  say(`Buscando ${targetAmount} bloque(s) de ${material}.`)

  while (taskId === currentTask && mined < targetAmount && bot?.player) {
    const block = bot.findBlock({
      matching: ids,
      maxDistance: 48
    })

    if (!block) {
      say(`No encuentro más ${material} cerca.`)
      break
    }

    try {
      await bot.pathfinder.goto(
        new GoalNear(block.position.x, block.position.y, block.position.z, 1)
      )

      if (taskId !== currentTask) break

      const currentBlock = bot.blockAt(block.position)
      if (currentBlock && ids.includes(currentBlock.type) && bot.canDigBlock(currentBlock)) {
        await bot.dig(currentBlock)
        mined++
      }
    } catch (error) {
      log(`No pude minar: ${error.message}`)
    }

    await sleep(300)
  }

  if (taskId === currentTask) {
    say(`Minería terminada: ${mined}/${targetAmount} bloque(s).`)
    stopAll()
  }
}

function inventoryText() {
  const items = bot.inventory.items()

  if (items.length === 0) return 'Inventario vacío.'

  const grouped = new Map()
  for (const item of items) {
    grouped.set(item.displayName, (grouped.get(item.displayName) || 0) + item.count)
  }

  const text = [...grouped.entries()]
    .map(([name, count]) => `${name} x${count}`)
    .join(', ')

  return text.length > 220 ? `${text.slice(0, 217)}...` : text
}

function statusText() {
  const health = Math.round(bot.health * 10) / 10
  const food = Math.round(bot.food)
  const position = bot.entity.position.floored()

  return `Modo: ${mode} | Vida: ${health}/20 | Comida: ${food}/20 | Pos: ${position.x}, ${position.y}, ${position.z}`
}

function showHelp() {
  say('Comandos: !help, !parar, !proteger, !desproteger, !seguir [jugador], !minar [material] [cantidad], !pelear mobs [segundos], !pelear jugador [segundos], !status, !inventario')
}

function handleCommand(username, message) {
  if (!isOwner(username)) return

  const args = message.trim().split(/\s+/)
  const command = normalize(args.shift())

  if (!command.startsWith('!')) return

  if (command === '!help') return showHelp()

  if (command === '!parar') {
    stopAll()
    return say('Listo, me detuve.')
  }

  if (command === '!proteger') {
    stopAll()
    protectOwner()
    return
  }

  if (command === '!desproteger') {
    stopAll()
    return say('Protección desactivada.')
  }

  if (command === '!seguir') {
    const targetName = normalize(args[0] || CONFIG.owner)
    stopAll()
    followPlayer(targetName)
    return
  }

  if (command === '!minar') {
    const material = args[0]
    const amount = args[1]

    if (!material) return say('Uso: !minar diamante 5')

    stopAll()
    mine(material, amount)
    return
  }

  if (command === '!pelear') {
    const type = normalize(args[0])
    const seconds = Math.max(5, Math.min(Number(args[1]) || 30, 300))

    stopAll()

    if (type === 'mobs' || type === 'mob') {
      const target = nearestHostile(32)
      if (!target) return say('No veo mobs cerca.')

      attackTarget(target, seconds, 'mobs')
      return
    }

    if (type === 'jugador' || type === 'player') {
      const target = ownerEntity()
      if (!target) return say(`No veo a ${CONFIG.owner}.`)

      attackTarget(target, seconds, `jugador ${CONFIG.owner}`)
      return
    }

    return say('Uso: !pelear mobs 60 o !pelear jugador 30')
  }

  if (command === '!status') return say(statusText())
  if (command === '!inventario' || command === '!inv') return say(inventoryText())

  say('Comando desconocido. Usa !help')
}

function sendPluginLoginIfNeeded(message) {
  if (loginSent || !CONFIG.pluginPassword) return

  const text = normalize(message)
  const asksForLogin =
    text.includes('/login') ||
    text.includes('/l ') ||
    text.includes('inicia sesión') ||
    text.includes('inicie sesión') ||
    text.includes('log in')

  if (asksForLogin) {
    loginSent = true
    setTimeout(() => {
      if (bot?.player) {
        bot.chat(`/login ${CONFIG.pluginPassword}`)
        log('Comando /login enviado.')
      }
    }, 1500)
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connect()
  }, CONFIG.reconnectMs)

  log(`Reconectando en ${CONFIG.reconnectMs / 1000} segundos...`)
}

function connect() {
  loginSent = false
  stopAll('Iniciando conexión...')

  log(`Conectando a ${CONFIG.host}:${CONFIG.port} como ${CONFIG.username}`)

  bot = mineflayer.createBot({
    host: CONFIG.host,
    port: CONFIG.port,
    username: CONFIG.username,
    auth: 'offline',
    version: false
  })

  bot.loadPlugin(pathfinder)

  bot.once('spawn', () => {
    movements = new Movements(bot)
    movements.canDig = true
    movements.allow1by1towers = false
    bot.pathfinder.setMovements(movements)

    log('Bot conectado al servidor.')
    say('Bot conectado. Usa !help, nicolas7878.')
  })

  bot.on('chat', handleCommand)

  bot.on('messagestr', message => {
    sendPluginLoginIfNeeded(message)
  })

  bot.on('kicked', reason => {
    log(`Expulsado: ${typeof reason === 'string' ? reason : JSON.stringify(reason)}`)
  })

  bot.on('error', error => {
    log(`Error: ${error.message}`)
  })

  bot.on('end', () => {
    log('Conexión terminada.')
    scheduleReconnect()
  })
}

process.on('SIGINT', () => {
  log('Cerrando bot...')
  if (reconnectTimer) clearTimeout(reconnectTimer)
  if (bot) bot.quit('Bot apagado')
  process.exit(0)
})

if (!CONFIG.pluginPassword) {
  log('Aviso: BOT_PASSWORD está vacío. El bot no podrá ejecutar /login.')
}

connect()
