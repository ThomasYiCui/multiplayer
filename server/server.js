const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// 1. MONGODB SCHEMA & FALLBACK LOCAL DB
let useMongo = false;
let UserModel = null;

if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000
    })
    .then(async () => {
        console.log('Connected to MongoDB Atlas');
        useMongo = true;
        await syncLocalToMongo();
    })
    .catch(err => {
        console.warn('MongoDB connection failed, falling back to local file storage:', err.message);
        useMongo = false;
    });
}

const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    gold: { type: Number, default: 0 },
    hp: { type: Number, default: 100 },
    maxHp: { type: Number, default: 100 },
    attack: { type: Number, default: 10 },
    defense: { type: Number, default: 5 },
    equipment: { type: Object, default: { weapon: null, armor: null } },
    inventory: { type: Array, default: [] }
});

try {
    UserModel = mongoose.model('User', userSchema);
} catch (e) {
    UserModel = mongoose.models.User;
}

// Local JSON fallback database
const LOCAL_DB_PATH = path.join(__dirname, 'local_database.json');
function getLocalUsers() {
    if (!fs.existsSync(LOCAL_DB_PATH)) return {};
    try {
        return JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf8'));
    } catch (e) {
        return {};
    }
}
function saveLocalUser(user) {
    try {
        const db = getLocalUsers();
        db[user.username.toLowerCase()] = user;
        fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error('Error saving local user:', e.message);
    }
}

// Auto-sync local fallback users into MongoDB Atlas on connection
async function syncLocalToMongo() {
    try {
        if (!UserModel || mongoose.connection.readyState !== 1) return;
        const localDb = getLocalUsers();
        for (const key in localDb) {
            const localUser = localDb[key];
            const exists = await UserModel.findOne({ username: new RegExp(`^${localUser.username}$`, 'i') });
            if (!exists) {
                const doc = new UserModel(localUser);
                await doc.save();
                console.log(`[Sync] Migrated local account to MongoDB Atlas: ${localUser.username}`);
            }
        }
    } catch (err) {
        console.warn('[Sync] Auto-migration error:', err.message);
    }
}

// Database helper functions
async function findUser(username) {
    const clean = username ? username.trim() : '';
    if (!clean) return null;

    if (useMongo && UserModel && mongoose.connection.readyState === 1) {
        try {
            const doc = await UserModel.findOne({ username: new RegExp(`^${clean}$`, 'i') });
            if (doc) return doc;
        } catch (err) {
            console.warn('MongoDB findUser error, checking local storage:', err.message);
        }
    }
    const db = getLocalUsers();
    return db[clean.toLowerCase()] || null;
}

async function createUser(username, hashedPassword) {
    const newUser = {
        username: username,
        password: hashedPassword,
        level: 1,
        xp: 0,
        gold: 0,
        hp: 100,
        maxHp: 100,
        attack: 10,
        defense: 5,
        equipment: { weapon: null, armor: null },
        inventory: []
    };

    // Always save local backup copy
    saveLocalUser(newUser);

    if (useMongo && UserModel && mongoose.connection.readyState === 1) {
        try {
            const doc = new UserModel(newUser);
            return await doc.save();
        } catch (err) {
            console.warn('MongoDB createUser error, saved to local storage:', err.message);
        }
    }
    return newUser;
}

async function saveUserStats(userData) {
    if (useMongo && UserModel && mongoose.connection.readyState === 1) {
        try {
            await UserModel.updateOne(
                { username: userData.username },
                {
                    $set: {
                        level: userData.level,
                        xp: userData.xp,
                        gold: userData.gold,
                        hp: userData.hp,
                        maxHp: userData.maxHp,
                        attack: userData.attack,
                        defense: userData.defense,
                        equipment: userData.equipment,
                        inventory: userData.inventory
                    }
                }
            );
            return;
        } catch (err) {
            console.warn('MongoDB saveUserStats error, fallback to local:', err.message);
        }
    }
    saveLocalUser(userData);
}

async function getAllUsers() {
    try {
        if (useMongo && UserModel && mongoose.connection.readyState === 1) {
            const list = await UserModel.find({}, { password: 0 }).lean();
            return list.map(u => ({
                username: u.username,
                level: u.level || 1,
                xp: u.xp || 0,
                gold: u.gold || 0,
                hp: u.hp || 100,
                maxHp: u.maxHp || 100,
                attack: u.attack || 10,
                defense: u.defense || 5,
                itemsCount: (u.inventory || []).length
            }));
        } else {
            const db = getLocalUsers();
            return Object.values(db).map(u => ({
                username: u.username,
                level: u.level || 1,
                xp: u.xp || 0,
                gold: u.gold || 0,
                hp: u.hp || 100,
                maxHp: u.maxHp || 100,
                attack: u.attack || 10,
                defense: u.defense || 5,
                itemsCount: (u.inventory || []).length
            }));
        }
    } catch (e) {
        console.error('Error fetching all users:', e);
        return [];
    }
}

// 2. THE 3 PERSISTENT WORLDS (Max 50 players each) & SERVER-SIDE ENEMIES
function createInitialWorldEnemies(worldId) {
    const enemies = {};
    let nextId = 1;

    function addEnemy(type, name, hp, speed, size, damage, xpReward, goldReward, aggroRadius, attackInterval, x, y) {
        const id = `${worldId}_enemy_${nextId++}`;
        enemies[id] = {
            id,
            type,
            name,
            hp,
            maxHp: hp,
            speed,
            size,
            damage,
            xpReward,
            goldReward,
            aggroRadius,
            attackInterval,
            x,
            y,
            spawnX: x,
            spawnY: y,
            vX: 0,
            vY: 0,
            knockbackX: 0,
            knockbackY: 0,
            r: 0,
            wanderAngle: Math.random() * Math.PI * 2,
            wanderTimer: Math.random() * 2 + 1.5,
            hitStunTimer: 0,
            attackCooldownTimer: Math.random() * 0.5,
            attackSwingTimer: 0,
            isAttacking: false,
            isDead: false
        };
    }

    // 1. Slime Nest (East forest clearing - 4 Bouncing Slimes)
    const slimes = [
        { x: 700, y: 160 }, { x: 740, y: 200 }, { x: 680, y: 220 }, { x: 750, y: 150 }
    ];
    for (const s of slimes) {
        addEnemy('Slime', 'Slime', 40, 130, 17, 8, 25, 6, 260, 0.8, s.x, s.y);
    }

    // 2. Goblin Camp (South-East ruins - 3 Goblins)
    const goblins = [
        { x: 740, y: 560 }, { x: 780, y: 600 }, { x: 720, y: 620 }
    ];
    for (const g of goblins) {
        addEnemy('Goblin', 'Goblin', 60, 150, 16, 12, 35, 12, 280, 0.9, g.x, g.y);
    }

    // 3. Skeleton Crypt (South-West dungeon - 3 Skeleton Warriors)
    const skeletons = [
        { x: -140, y: 500 }, { x: -180, y: 540 }, { x: -120, y: 560 }
    ];
    for (const sk of skeletons) {
        addEnemy('Skeleton', 'Skeleton', 85, 110, 18, 16, 50, 20, 300, 1.2, sk.x, sk.y);
    }

    // 4. Orc Outpost (North-West mountain - 1 Orc Berserker + 2 Goblins)
    addEnemy('Orc', 'Orc Berserker', 170, 85, 26, 28, 120, 60, 320, 1.5, -220, -120);
    addEnemy('Goblin', 'Goblin', 60, 150, 16, 12, 35, 12, 280, 0.9, -170, -80);
    addEnemy('Goblin', 'Goblin', 60, 150, 16, 12, 35, 12, 280, 0.9, -260, -140);

    return enemies;
}

const WORLDS = {
    'world-1': {
        id: 'world-1',
        name: 'Server 1',
        maxPlayers: 50,
        players: {},
        enemies: createInitialWorldEnemies('world-1')
    },
    'world-2': {
        id: 'world-2',
        name: 'Server 2',
        maxPlayers: 50,
        players: {},
        enemies: createInitialWorldEnemies('world-2')
    },
    'world-3': {
        id: 'world-3',
        name: 'Server 3',
        maxPlayers: 50,
        players: {},
        enemies: createInitialWorldEnemies('world-3')
    }
};

// SERVER SIMULATION TICK LOOP (20 Hz)
const SERVER_TICK_RATE = 20; // 20 updates per second
const DT = 1 / SERVER_TICK_RATE; // 0.05s

setInterval(() => {
    for (const worldId in WORLDS) {
        const world = WORLDS[worldId];
        const playerCount = Object.keys(world.players).length;
        if (playerCount === 0) continue; // Skip computing AI when no players are in the world

        for (const enemyId in world.enemies) {
            const enemy = world.enemies[enemyId];
            if (enemy.isDead) continue;

            // 1. Timers
            if (enemy.hitStunTimer > 0) enemy.hitStunTimer -= DT;
            if (enemy.attackCooldownTimer > 0) enemy.attackCooldownTimer -= DT;
            if (enemy.attackSwingTimer > 0) enemy.attackSwingTimer -= DT;
            if (enemy.attackSwingTimer <= 0) enemy.isAttacking = false;

            // 2. Knockback Friction Decay
            if (Math.abs(enemy.knockbackX) > 2 || Math.abs(enemy.knockbackY) > 2) {
                const friction = Math.pow(0.05, DT);
                enemy.knockbackX *= friction;
                enemy.knockbackY *= friction;
            } else {
                enemy.knockbackX = 0;
                enemy.knockbackY = 0;
            }

            // 3. Find Nearest Player
            let nearestPlayer = null;
            let minDist = Infinity;
            for (const pid in world.players) {
                const p = world.players[pid];
                if (p.hp <= 0) continue;
                const dist = Math.hypot(p.x - enemy.x, p.y - enemy.y);
                if (dist < minDist) {
                    minDist = dist;
                    nearestPlayer = p;
                }
            }

            // 4. Calculate AI Movement Intent Velocity
            let moveVx = 0;
            let moveVy = 0;

            // Only steer forward when not in initial hit recoil
            if (enemy.hitStunTimer <= 0) {
                if (nearestPlayer && minDist <= enemy.aggroRadius) {
                    const playerRadius = nearestPlayer.size || 20;
                    const contactDist = enemy.size + playerRadius;
                    const stopDist = contactDist - 4;

                    if (minDist > stopDist) {
                        const angle = Math.atan2(nearestPlayer.y - enemy.y, nearestPlayer.x - enemy.x);
                        const currentSpeed = enemy.isAttacking ? enemy.speed * 0.4 : enemy.speed;
                        moveVx = Math.cos(angle) * currentSpeed;
                        moveVy = Math.sin(angle) * currentSpeed;
                    }

                    // Enemy Attacks Player ONLY on physical contact
                    if (minDist <= contactDist && enemy.attackCooldownTimer <= 0) {
                        enemy.attackCooldownTimer = enemy.attackInterval;
                        enemy.isAttacking = true;
                        enemy.attackSwingTimer = 0.35;

                        nearestPlayer.hp = Math.max(0, nearestPlayer.hp - enemy.damage);
                        const pushAngle = Math.atan2(nearestPlayer.y - enemy.y, nearestPlayer.x - enemy.x);

                        io.to(world.id).emit('playerDamaged', {
                            targetId: nearestPlayer.id,
                            attackerId: enemy.id,
                            damage: enemy.damage,
                            hp: nearestPlayer.hp,
                            maxHp: nearestPlayer.maxHp,
                            pushAngle: pushAngle,
                            pushForce: 450
                        });

                        if (nearestPlayer.hp <= 0) {
                            setTimeout(() => {
                                if (world.players[nearestPlayer.id]) {
                                    world.players[nearestPlayer.id].hp = world.players[nearestPlayer.id].maxHp;
                                    world.players[nearestPlayer.id].x = Math.floor(Math.random() * 400) + 100;
                                    world.players[nearestPlayer.id].y = Math.floor(Math.random() * 300) + 100;

                                    io.to(world.id).emit('playerRespawned', {
                                        id: nearestPlayer.id,
                                        hp: world.players[nearestPlayer.id].hp,
                                        x: world.players[nearestPlayer.id].x,
                                        y: world.players[nearestPlayer.id].y
                                    });
                                }
                            }, 2000);
                        }
                    }
                } else {
                    // Roam around spawn anchor
                    enemy.wanderTimer -= DT;
                    if (enemy.wanderTimer <= 0) {
                        enemy.wanderAngle = Math.random() * Math.PI * 2;
                        enemy.wanderTimer = Math.random() * 3 + 1.5;
                    }
                    const distFromSpawn = Math.hypot(enemy.x - enemy.spawnX, enemy.y - enemy.spawnY);
                    if (distFromSpawn > 250) {
                        enemy.wanderAngle = Math.atan2(enemy.spawnY - enemy.y, enemy.spawnX - enemy.x);
                    }
                    moveVx = Math.cos(enemy.wanderAngle) * (enemy.speed * 0.45);
                    moveVy = Math.sin(enemy.wanderAngle) * (enemy.speed * 0.45);
                    enemy.r = enemy.wanderAngle + Math.PI;
                }
            }

            // 5. Additive Physics Integration (Movement Velocity + Knockback Impulse)
            enemy.x += (moveVx + enemy.knockbackX) * DT;
            enemy.y += (moveVy + enemy.knockbackY) * DT;
        }

        // Broadcast World Enemies Snapshot (20 Hz)
        const snapshots = Object.values(world.enemies).map(e => ({
            id: e.id,
            type: e.type,
            name: e.name,
            x: Math.round(e.x * 10) / 10,
            y: Math.round(e.y * 10) / 10,
            r: Math.round(e.r * 100) / 100,
            hp: Math.round(e.hp),
            maxHp: e.maxHp,
            isAttacking: e.isAttacking,
            isDead: e.isDead
        }));

        io.to(world.id).emit('enemiesUpdate', {
            time: Date.now(),
            enemies: snapshots
        });
    }
}, 1000 / SERVER_TICK_RATE);

function getWorldsList() {
    return Object.values(WORLDS).map(w => ({
        id: w.id,
        name: w.name,
        playerCount: Object.keys(w.players).length,
        maxPlayers: w.maxPlayers
    }));
}

function broadcastWorldList() {
    io.emit('worldList', getWorldsList());
}

// Helper: Format uptime
function formatUptime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
}

// 3. STATS API & HTML DASHBOARD
app.get('/api/stats', async (req, res) => {
    const memory = process.memoryUsage();
    const usedMB = (memory.rss / 1024 / 1024).toFixed(1);

    let totalPlayers = 0;
    for (const id in WORLDS) {
        totalPlayers += Object.keys(WORLDS[id].players).length;
    }

    const registeredUsers = await getAllUsers();

    res.json({
        status: 'Online',
        database: useMongo ? 'MongoDB Atlas' : 'Local Storage',
        totalRegistered: registeredUsers.length,
        uptime: formatUptime(process.uptime()),
        totalPlayers,
        totalRooms: 3,
        memoryUsedMB: usedMB,
        totalMemoryMB: 512,
        worlds: getWorldsList(),
        users: registeredUsers
    });
});

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Game Server Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #0b0f19; color: #f1f5f9; padding: 30px 20px; display: flex; justify-content: center; }
    .container { max-width: 960px; width: 100%; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    h1 { font-size: 22px; color: #38bdf8; display: flex; align-items: center; gap: 10px; }
    .header-links { display: flex; align-items: center; gap: 12px; }
    .play-link { background: #0284c7; color: white; text-decoration: none; padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; }
    .status-badge { background: #064e3b; color: #34d399; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; border: 1px solid #059669; }
    
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; }
    .card-title { font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 700; margin-bottom: 8px; }
    .card-value { font-size: 26px; font-weight: 700; color: #f8fafc; }
    .progress-bg { background: #334155; border-radius: 6px; height: 8px; margin-top: 10px; overflow: hidden; }
    .progress-fill { background: #38bdf8; height: 100%; width: 0%; transition: width 0.3s ease; }

    .table-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { text-align: left; font-size: 12px; color: #64748b; text-transform: uppercase; padding: 10px 12px; border-bottom: 1px solid #334155; }
    td { padding: 12px; font-size: 14px; border-bottom: 1px solid #334155; }
    .room-badge { background: #0f172a; color: #38bdf8; padding: 4px 10px; border-radius: 6px; font-weight: bold; border: 1px solid #334155; }
    .user-tag { color: #f8fafc; font-weight: 700; }
    .lvl-tag { color: #38bdf8; font-weight: 700; }
    .gold-tag { color: #fbbf24; font-weight: 700; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Multiplayer Server Status</h1>
      <div class="header-links">
        <a href="https://thomasyicui.github.io/multiplayer/" target="_blank" class="play-link">Play Game</a>
        <span class="status-badge" id="statusBadge">Online</span>
      </div>
    </header>

    <div class="grid">
      <div class="card">
        <div class="card-title">Online Players</div>
        <div class="card-value" id="playerCount">0</div>
      </div>
      <div class="card">
        <div class="card-title">Database</div>
        <div class="card-value" style="font-size: 18px; padding-top: 6px;" id="dbStatus">Loading...</div>
      </div>
      <div class="card">
        <div class="card-title">Registered Accounts</div>
        <div class="card-value" id="regCount">0</div>
      </div>
      <div class="card">
        <div class="card-title">RAM Usage</div>
        <div class="card-value" id="ramValue">0 MB</div>
        <div class="progress-bg"><div class="progress-fill" id="ramBar"></div></div>
      </div>
      <div class="card">
        <div class="card-title">Server Uptime</div>
        <div class="card-value" style="font-size: 18px; padding-top: 6px;" id="uptimeValue">0s</div>
      </div>
    </div>

    <div class="table-card">
      <div class="card-title">Active Servers (Max 50 Players)</div>
      <table>
        <thead>
          <tr>
            <th>Server Name</th>
            <th>Players</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="worldsTableBody">
          <tr><td colspan="3">Loading servers...</td></tr>
        </tbody>
      </table>
    </div>

    <div class="table-card">
      <div class="card-title">MongoDB Registered Accounts & Player Stats</div>
      <table>
        <thead>
          <tr>
            <th>Username</th>
            <th>Level</th>
            <th>HP</th>
            <th>Gold</th>
            <th>ATK / DEF</th>
            <th>Inventory Items</th>
          </tr>
        </thead>
        <tbody id="usersTableBody">
          <tr><td colspan="6">Loading database users...</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <script>
    async function updateStats() {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        
        document.getElementById('playerCount').innerText = data.totalPlayers;
        document.getElementById('dbStatus').innerText = data.database;
        document.getElementById('regCount').innerText = data.totalRegistered || 0;
        document.getElementById('uptimeValue').innerText = data.uptime;
        
        const ramPercent = Math.min(100, ((data.memoryUsedMB / data.totalMemoryMB) * 100)).toFixed(0);
        document.getElementById('ramValue').innerText = data.memoryUsedMB + ' / ' + data.totalMemoryMB + ' MB';
        document.getElementById('ramBar').style.width = ramPercent + '%';

        const tbodyWorlds = document.getElementById('worldsTableBody');
        tbodyWorlds.innerHTML = data.worlds.map(w => \`
          <tr>
            <td><span class="room-badge">\${w.name}</span></td>
            <td>\${w.playerCount} / \${w.maxPlayers}</td>
            <td><span style="color: #34d399; font-weight: bold;">Open</span></td>
          </tr>
        \`).join('');

        const tbodyUsers = document.getElementById('usersTableBody');
        if (!data.users || data.users.length === 0) {
          tbodyUsers.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #64748b;">No registered players yet. Register in game to create an entry!</td></tr>';
        } else {
          tbodyUsers.innerHTML = data.users.map(u => \`
            <tr>
              <td><span class="user-tag">\${u.username}</span></td>
              <td><span class="lvl-tag">Lv. \${u.level}</span> (\${u.xp} XP)</td>
              <td>\${u.hp} / \${u.maxHp}</td>
              <td><span class="gold-tag">\${u.gold} Gold</span></td>
              <td>\${u.attack} / \${u.defense}</td>
              <td>\${u.itemsCount} items</td>
            </tr>
          \`).join('');
        }
      } catch (err) {
        document.getElementById('statusBadge').innerText = 'Reconnecting...';
        document.getElementById('statusBadge').style.background = '#7f1d1d';
        document.getElementById('statusBadge').style.color = '#fca5a5';
      }
    }

    setInterval(updateStats, 2000);
    updateStats();
  </script>
</body>
</html>
    `);
});

// 4. SOCKET.IO MULTIPLAYER & AUTHENTICATION
io.on('connection', (socket) => {
    let currentWorld = null;
    let currentUser = null;

    console.log(`[+] Connected: ${socket.id}`);

    // Send world list on connect
    socket.emit('worldList', getWorldsList());

    // REGISTER ACCOUNT
    socket.on('register', async ({ username, password }) => {
        try {
            const cleanUser = username?.trim();
            if (!cleanUser || cleanUser.length < 3) {
                return socket.emit('authError', 'Username must be at least 3 characters.');
            }
            if (!password || password.length < 4) {
                return socket.emit('authError', 'Password must be at least 4 characters.');
            }

            const existing = await findUser(cleanUser);
            if (existing) {
                return socket.emit('authError', 'Username already taken. Please choose another.');
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const user = await createUser(cleanUser, hashedPassword);

            currentUser = {
                username: user.username,
                level: user.level || 1,
                xp: user.xp || 0,
                gold: user.gold || 0,
                hp: user.hp || 100,
                maxHp: user.maxHp || 100,
                attack: user.attack || 10,
                defense: user.defense || 5,
                equipment: user.equipment || {},
                inventory: user.inventory || []
            };

            socket.emit('authSuccess', { user: currentUser });
            console.log(`Registered new player: ${cleanUser}`);
        } catch (err) {
            console.error('Register error:', err);
            socket.emit('authError', `Registration error: ${err.message || 'Unknown server error'}`);
        }
    });

    // LOGIN ACCOUNT
    socket.on('login', async ({ username, password }) => {
        try {
            const cleanUser = username?.trim();
            if (!cleanUser || !password) {
                return socket.emit('authError', 'Please enter username and password.');
            }

            const user = await findUser(cleanUser);
            if (!user) {
                return socket.emit('authError', 'User not found. Please click the Register tab to create an account first!');
            }

            if (!user.password) {
                return socket.emit('authError', 'Account corrupted. Please register a new username.');
            }

            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                return socket.emit('authError', 'Incorrect password.');
            }

            const isThimi = user.username === 'ThimiTuah';
            currentUser = {
                username: user.username,
                level: user.level || 1,
                xp: user.xp || 0,
                gold: user.gold || 0,
                hp: isThimi ? 1000 : (user.hp || 100),
                maxHp: isThimi ? 1000 : (user.maxHp || 100),
                attack: user.attack || 10,
                defense: user.defense || 5,
                equipment: user.equipment || {},
                inventory: user.inventory || []
            };

            socket.emit('authSuccess', { user: currentUser });
            console.log(`Player logged in: ${cleanUser}`);
        } catch (err) {
            console.error('Login error:', err);
            socket.emit('authError', `Login error: ${err.message || 'Unknown server error'}`);
        }
    });

    // JOIN ONE OF THE 3 WORLDS
    socket.on('joinWorld', ({ worldId }) => {
        if (!currentUser) {
            return socket.emit('authError', 'Please login before entering a world.');
        }

        const world = WORLDS[worldId];
        if (!world) {
            return socket.emit('errorMsg', 'World not found.');
        }

        const currentCount = Object.keys(world.players).length;
        if (currentCount >= world.maxPlayers) {
            return socket.emit('errorMsg', 'This world is currently full (50/50 players).');
        }

        // Leave any previous world
        if (currentWorld && WORLDS[currentWorld]) {
            delete WORLDS[currentWorld].players[socket.id];
            socket.to(currentWorld).emit('playerLeft', socket.id);
            socket.leave(currentWorld);
        }

        currentWorld = worldId;
        socket.join(worldId);

        const newPlayer = {
            id: socket.id,
            name: currentUser.username,
            level: currentUser.level,
            hp: currentUser.hp,
            maxHp: currentUser.maxHp,
            gold: currentUser.gold,
            x: Math.floor(Math.random() * 400) + 100,
            y: Math.floor(Math.random() * 300) + 100,
            r: 0,
            color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
        };

        world.players[socket.id] = newPlayer;

        socket.emit('worldJoined', {
            worldId: world.id,
            worldName: world.name,
            selfId: socket.id,
            user: currentUser,
            players: world.players,
            enemies: Object.values(world.enemies).map(e => ({
                id: e.id,
                type: e.type,
                name: e.name,
                x: e.x,
                y: e.y,
                hp: e.hp,
                maxHp: e.maxHp,
                level: e.level,
                isDead: e.isDead
            }))
        });

        socket.to(worldId).emit('playerJoined', newPlayer);
        broadcastWorldList();
        console.log(`Player ${currentUser.username} entered ${world.name}`);
    });

    // LEAVE WORLD BACK TO WORLD SELECT
    socket.on('leaveWorld', async () => {
        if (currentWorld && WORLDS[currentWorld]) {
            delete WORLDS[currentWorld].players[socket.id];
            socket.to(currentWorld).emit('playerLeft', socket.id);
            socket.leave(currentWorld);
            currentWorld = null;
            broadcastWorldList();
        }
        if (currentUser) {
            await saveUserStats(currentUser);
        }
        socket.emit('worldList', getWorldsList());
    });

    // PING / LATENCY CHECK
    socket.on('pingCheck', (clientTimestamp) => {
        socket.emit('pongCheck', clientTimestamp);
    });

    // UNIFIED PLAYER UPDATE (Position + Rotation + State)
    socket.on('playerUpdate', (data) => {
        if (currentWorld && WORLDS[currentWorld]?.players[socket.id]) {
            const p = WORLDS[currentWorld].players[socket.id];
            p.x = data.x;
            p.y = data.y;
            p.r = data.r;
            p.mouseX = data.mouseX;
            p.mouseY = data.mouseY;

            socket.to(currentWorld).emit('playerUpdate', {
                id: socket.id,
                x: data.x,
                y: data.y,
                r: data.r,
                mouseX: data.mouseX,
                mouseY: data.mouseY,
                time: data.time || Date.now()
            });
        }
    });

    // MOVEMENT (Fallback)
    socket.on('playerMove', (data) => {
        if (currentWorld && WORLDS[currentWorld]?.players[socket.id]) {
            const p = WORLDS[currentWorld].players[socket.id];
            p.x = data.x;
            p.y = data.y;

            socket.to(currentWorld).emit('playerMoved', { id: socket.id, x: data.x, y: data.y, time: Date.now() });
        }
    });

    // MOUSE & ROTATION (Fallback)
    socket.on('playerMouse', (data) => {
        if (currentWorld && WORLDS[currentWorld]?.players[socket.id]) {
            const p = WORLDS[currentWorld].players[socket.id];
            p.mouseX = data.mouseX;
            p.mouseY = data.mouseY;
            p.r = data.r;
            p.clicked = data.clicked;
            p.dragged = data.dragged;

            socket.to(currentWorld).emit('playerMouse', {
                id: socket.id,
                mouseX: data.mouseX,
                mouseY: data.mouseY,
                r: data.r,
                clicked: data.clicked,
                dragged: data.dragged,
                time: Date.now()
            });
        }
    });

    // COMBAT: Player hits another player (Server Validated)
    socket.on('playerHit', ({ targetId, damage, pushAngle, pushForce }) => {
        if (!currentWorld || !WORLDS[currentWorld]) return;
        const world = WORLDS[currentWorld];
        const target = world.players[targetId];
        const attacker = world.players[socket.id];

        if (target && attacker) {
            if (target.hp <= 0 || attacker.hp <= 0) return;

            // SERVER HIT VALIDATION: Check distance between attacker and target
            const dist = Math.hypot(target.x - attacker.x, target.y - attacker.y);
            const MAX_ALLOWED_DISTANCE = 280; // Max weapon reach (Spear 172 + radius 20 + tolerance 88)

            if (dist > MAX_ALLOWED_DISTANCE) {
                console.log(`[Combat] Rejected out-of-range hit from ${attacker.name} to ${target.name} (dist: ${dist.toFixed(1)}px > ${MAX_ALLOWED_DISTANCE}px)`);
                return;
            }

            const actualDamage = Math.min(50, Math.max(1, damage || 15));
            target.hp = Math.max(0, target.hp - actualDamage);

            const force = pushForce || 480;
            const angle = pushAngle !== undefined ? pushAngle : Math.atan2(target.y - attacker.y, target.x - attacker.x);

            // Broadcast damage & knockback vector to all players in the world
            io.to(currentWorld).emit('playerDamaged', {
                targetId: targetId,
                attackerId: socket.id,
                damage: actualDamage,
                hp: target.hp,
                maxHp: target.maxHp,
                pushAngle: angle,
                pushForce: force
            });

            // If target died, respawn after 2 seconds
            if (target.hp <= 0) {
                setTimeout(() => {
                    if (world.players[targetId]) {
                        world.players[targetId].hp = world.players[targetId].maxHp;
                        world.players[targetId].x = Math.floor(Math.random() * 400) + 100;
                        world.players[targetId].y = Math.floor(Math.random() * 300) + 100;

                        io.to(currentWorld).emit('playerRespawned', {
                            id: targetId,
                            hp: world.players[targetId].hp,
                            x: world.players[targetId].x,
                            y: world.players[targetId].y
                        });
                    }
                }, 2000);
            }
        }
    });

    // COMBAT: Player hits an Enemy (Server Validated)
    socket.on('enemyHit', ({ enemyId, damage, pushAngle, pushForce }) => {
        if (!currentWorld || !WORLDS[currentWorld]) return;
        const world = WORLDS[currentWorld];
        const attacker = world.players[socket.id];
        const enemy = world.enemies[enemyId];

        if (!attacker || !enemy || enemy.isDead || attacker.hp <= 0) return;

        // Distance validation
        const dist = Math.hypot(enemy.x - attacker.x, enemy.y - attacker.y);
        const MAX_ALLOWED_DISTANCE = 300;
        if (dist > MAX_ALLOWED_DISTANCE) {
            return;
        }

        const actualDamage = Math.min(80, Math.max(1, damage || 15));
        enemy.hp = Math.max(0, enemy.hp - actualDamage);

        const angle = pushAngle !== undefined ? pushAngle : Math.atan2(enemy.y - attacker.y, enemy.x - attacker.x);
        const force = pushForce || 600;

        enemy.hitStunTimer = 0.35; // Stun enemy so knockback takes full effect without walking forward
        enemy.attackCooldownTimer = Math.max(enemy.attackCooldownTimer, 0.45); // Cancel and reset attack timer
        enemy.isAttacking = false;
        enemy.knockbackX = Math.cos(angle) * force;
        enemy.knockbackY = Math.sin(angle) * force;

        io.to(currentWorld).emit('enemyDamaged', {
            enemyId: enemy.id,
            attackerId: socket.id,
            damage: actualDamage,
            hp: enemy.hp,
            maxHp: enemy.maxHp,
            pushAngle: angle,
            pushForce: force
        });

        if (enemy.hp <= 0) {
            enemy.isDead = true;

            // Reward attacker (EXP & Gold)
            if (currentUser) {
                currentUser.xp = (currentUser.xp || 0) + (enemy.xpReward || 20);
                currentUser.gold = (currentUser.gold || 0) + (enemy.goldReward || 5);
                const neededXp = (currentUser.level || 1) * 100;
                if (currentUser.xp >= neededXp) {
                    currentUser.level = (currentUser.level || 1) + 1;
                    currentUser.xp -= neededXp;
                    currentUser.maxHp = (currentUser.maxHp || 100) + 20;
                    currentUser.hp = currentUser.maxHp;
                }
                saveUserStats(currentUser);

                // Sync updated stats to attacker client without re-triggering login navigation
                socket.emit('userStatsUpdate', { user: currentUser });
            }

            io.to(currentWorld).emit('enemyDied', {
                enemyId: enemy.id,
                killerId: socket.id,
                xpReward: enemy.xpReward,
                goldReward: enemy.goldReward
            });

            // Schedule Respawn after 12 seconds
            setTimeout(() => {
                if (world.enemies[enemy.id]) {
                    const e = world.enemies[enemy.id];
                    e.hp = e.maxHp;
                    e.isDead = false;
                    e.x = e.spawnX;
                    e.y = e.spawnY;
                    e.knockbackX = 0;
                    e.knockbackY = 0;

                    io.to(world.id).emit('enemySpawned', {
                        id: e.id,
                        type: e.type,
                        name: e.name,
                        x: e.x,
                        y: e.y,
                        hp: e.hp,
                        maxHp: e.maxHp,
                        level: e.level
                    });
                }
            }, 12000);
        }
    });

    // DISCONNECT
    socket.on('disconnect', async () => {
        if (currentWorld && WORLDS[currentWorld]) {
            delete WORLDS[currentWorld].players[socket.id];
            socket.to(currentWorld).emit('playerLeft', socket.id);
            broadcastWorldList();
        }
        if (currentUser) {
            await saveUserStats(currentUser);
        }
        console.log(`[-] Disconnected: ${socket.id}`);
    });
});

server.listen(PORT, () => {
    console.log(`RPG Game Server running on port ${PORT}`);
});
