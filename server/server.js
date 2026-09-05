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

// 2. THE 3 PERSISTENT WORLDS (Max 50 players each)
const WORLDS = {
    'world-1': {
        id: 'world-1',
        name: 'Server 1',
        maxPlayers: 50,
        players: {}
    },
    'world-2': {
        id: 'world-2',
        name: 'Server 2',
        maxPlayers: 50,
        players: {}
    },
    'world-3': {
        id: 'world-3',
        name: 'Server 3',
        maxPlayers: 50,
        players: {}
    }
};

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
            players: world.players
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
                mouseY: data.mouseY
            });
        }
    });

    // MOVEMENT (Fallback)
    socket.on('playerMove', (data) => {
        if (currentWorld && WORLDS[currentWorld]?.players[socket.id]) {
            const p = WORLDS[currentWorld].players[socket.id];
            p.x = data.x;
            p.y = data.y;

            socket.to(currentWorld).emit('playerMoved', { id: socket.id, x: data.x, y: data.y });
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
                dragged: data.dragged
            });
        }
    });

    // COMBAT: Player hits another player
    socket.on('playerHit', ({ targetId, damage, pushAngle, pushForce, pushX, pushY }) => {
        if (!currentWorld || !WORLDS[currentWorld]) return;
        const world = WORLDS[currentWorld];
        const target = world.players[targetId];
        const attacker = world.players[socket.id];

        if (target && attacker) {
            const actualDamage = Math.max(1, damage || 15);
            target.hp = Math.max(0, target.hp - actualDamage);

            const force = pushForce || 360;
            const angle = pushAngle !== undefined ? pushAngle : Math.atan2(target.y - attacker.y, target.x - attacker.x);

            // Server-side estimate of knockback position
            target.x += Math.cos(angle) * (force * 0.12);
            target.y += Math.sin(angle) * (force * 0.12);

            // Broadcast damage & knockback vector to all players in the world
            io.to(currentWorld).emit('playerDamaged', {
                targetId: targetId,
                attackerId: socket.id,
                damage: actualDamage,
                hp: target.hp,
                maxHp: target.maxHp,
                pushAngle: angle,
                pushForce: force,
                newX: target.x,
                newY: target.y
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
