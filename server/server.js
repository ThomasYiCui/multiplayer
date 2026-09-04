const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');

const app = express();
const server = http.createServer(app);

// Allow any client (localhost or your GitHub Pages domain)
const io = new Server(server, {
    cors: { origin: '*' }
});

// Use cloud port if deployed on Render, otherwise default to 3000
const PORT = process.env.PORT || 3000;

// Store room data: { [roomCode]: { players: { [socketId]: { x, y, name, color } } } }
const rooms = {};

// Helper: Format uptime (hours, minutes, seconds)
function formatUptime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
}

// 1. STATS API ENDPOINT
app.get('/api/stats', (req, res) => {
    const memory = process.memoryUsage();
    const usedMB = (memory.rss / 1024 / 1024).toFixed(1);

    let totalPlayers = 0;
    const roomList = [];

    for (const code in rooms) {
        const pCount = Object.keys(rooms[code].players).length;
        totalPlayers += pCount;
        roomList.push({
            code: code,
            playerCount: pCount,
            players: Object.values(rooms[code].players).map(p => p.name)
        });
    }

    res.json({
        status: 'Online',
        uptime: formatUptime(process.uptime()),
        totalPlayers,
        totalRooms: Object.keys(rooms).length,
        memoryUsedMB: usedMB,
        totalMemoryMB: 512, // Render Free Tier limit
        rooms: roomList
    });
});

// 2. SERVE LIVE HTML DASHBOARD AT ROOT (https://multiplayer-18xd.onrender.com/)
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
    .container { max-width: 900px; width: 100%; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    h1 { font-size: 22px; color: #38bdf8; display: flex; align-items: center; gap: 10px; }
    .header-links { display: flex; align-items: center; gap: 12px; }
    .play-link { background: #0284c7; color: white; text-decoration: none; padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; transition: background 0.2s; }
    .play-link:hover { background: #0369a1; }
    .status-badge { background: #064e3b; color: #34d399; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; border: 1px solid #059669; }
    
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .card-title { font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 700; margin-bottom: 8px; letter-spacing: 0.05em; }
    .card-value { font-size: 28px; font-weight: 700; color: #f8fafc; }
    .progress-bg { background: #334155; border-radius: 6px; height: 8px; margin-top: 10px; overflow: hidden; }
    .progress-fill { background: #38bdf8; height: 100%; width: 0%; transition: width 0.3s ease; }

    .table-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { text-align: left; font-size: 12px; color: #64748b; text-transform: uppercase; padding: 10px 12px; border-bottom: 1px solid #334155; }
    td { padding: 12px; font-size: 14px; border-bottom: 1px solid #334155; }
    .room-badge { background: #0f172a; color: #38bdf8; padding: 4px 10px; border-radius: 6px; font-weight: bold; border: 1px solid #334155; letter-spacing: 1px; }
    .empty-msg { text-align: center; color: #64748b; padding: 24px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Multiplayer Server Status</h1>
      <div class="header-links">
        <a href="https://thomasyicui.github.io/multiplayer/" target="_blank" class="play-link">🕹️ Play Game</a>
        <span class="status-badge" id="statusBadge">🟢 Online</span>
      </div>
    </header>

    <div class="grid">
      <div class="card">
        <div class="card-title">Online Players</div>
        <div class="card-value" id="playerCount">0</div>
      </div>
      <div class="card">
        <div class="card-title">Active Rooms</div>
        <div class="card-value" id="roomCount">0</div>
      </div>
      <div class="card">
        <div class="card-title">RAM Usage</div>
        <div class="card-value" id="ramValue">0 MB</div>
        <div class="progress-bg"><div class="progress-fill" id="ramBar"></div></div>
      </div>
      <div class="card">
        <div class="card-title">Server Uptime</div>
        <div class="card-value" style="font-size: 20px; padding-top: 6px;" id="uptimeValue">0s</div>
      </div>
    </div>

    <div class="table-card">
      <div class="card-title">Live Active Rooms</div>
      <table>
        <thead>
          <tr>
            <th>Room Code</th>
            <th>Players</th>
            <th>Player Names</th>
          </tr>
        </thead>
        <tbody id="roomsTableBody">
          <tr><td colspan="3" class="empty-msg">No active rooms right now</td></tr>
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
        document.getElementById('roomCount').innerText = data.totalRooms;
        document.getElementById('uptimeValue').innerText = data.uptime;
        
        const ramPercent = Math.min(100, ((data.memoryUsedMB / data.totalMemoryMB) * 100)).toFixed(0);
        document.getElementById('ramValue').innerText = data.memoryUsedMB + ' / ' + data.totalMemoryMB + ' MB';
        document.getElementById('ramBar').style.width = ramPercent + '%';

        const tbody = document.getElementById('roomsTableBody');
        if (data.rooms.length === 0) {
          tbody.innerHTML = '<tr><td colspan="3" class="empty-msg">No active rooms right now</td></tr>';
        } else {
          tbody.innerHTML = data.rooms.map(r => \`
            <tr>
              <td><span class="room-badge">\${r.code}</span></td>
              <td>\${r.playerCount}</td>
              <td>\${r.players.join(', ') || 'None'}</td>
            </tr>
          \`).join('');
        }

        document.getElementById('statusBadge').innerText = '🟢 Online';
        document.getElementById('statusBadge').style.background = '#064e3b';
        document.getElementById('statusBadge').style.color = '#34d399';
      } catch (err) {
        document.getElementById('statusBadge').innerText = '🔴 Reconnecting...';
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

// Helper: Generate a random 4-letter room code (e.g., "GAME", "Z4K9")
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

io.on('connection', (socket) => {
    let currentRoom = null;

    console.log(`[+] Connected: ${socket.id}`);

    // 1. CREATE A ROOM
    socket.on('createRoom', ({ playerName }) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = {
            code: roomCode,
            players: {}
        };

        joinRoomLogic(socket, roomCode, playerName);
    });

    // 2. JOIN AN EXISTING ROOM
    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const code = roomCode.toUpperCase().trim();
        if (!rooms[code]) {
            return socket.emit('errorMsg', 'Room not found! Check the code.');
        }
        joinRoomLogic(socket, code, playerName);
    });

    // Reusable join logic
    function joinRoomLogic(socket, roomCode, playerName) {
        currentRoom = roomCode;
        socket.join(roomCode);

        const newPlayer = {
            id: socket.id,
            name: playerName || `Player-${socket.id.substring(0, 4)}`,
            x: Math.floor(Math.random() * 400) + 100,
            y: Math.floor(Math.random() * 300) + 100,
            color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
        };

        rooms[roomCode].players[socket.id] = newPlayer;

        // Send the room code and all players in the room to the joining player
        socket.emit('roomJoined', {
            roomCode: roomCode,
            selfId: socket.id,
            players: rooms[roomCode].players
        });

        // Notify others in this room only
        socket.to(roomCode).emit('playerJoined', newPlayer);
        console.log(`Player ${newPlayer.name} joined room: ${roomCode}`);
    }

    // 3. MOVEMENT / POSITION UPDATE
    socket.on('playerMove', (data) => {
        if (currentRoom && rooms[currentRoom]?.players[socket.id]) {
            const p = rooms[currentRoom].players[socket.id];
            p.x = data.x;
            p.y = data.y;

            // Broadcast new position to everyone in the room
            socket.to(currentRoom).emit('playerMoved', { id: socket.id, x: data.x, y: data.y });
        }
    });

    // 4. MOUSE / CLICK / DRAG UPDATE
    socket.on('playerMouse', (data) => {
        if (currentRoom && rooms[currentRoom]?.players[socket.id]) {
            const p = rooms[currentRoom].players[socket.id];
            p.mouseX = data.mouseX;
            p.mouseY = data.mouseY;
            p.clicked = data.clicked;
            p.dragged = data.dragged;

            socket.to(currentRoom).emit('playerMouse', {
                id: socket.id,
                mouseX: data.mouseX,
                mouseY: data.mouseY,
                clicked: data.clicked,
                dragged: data.dragged
            });
        }
    });

    // 5. DISCONNECT / LEAVE
    socket.on('disconnect', () => {
        if (currentRoom && rooms[currentRoom]) {
            delete rooms[currentRoom].players[socket.id];
            socket.to(currentRoom).emit('playerLeft', socket.id);

            // Clean up empty rooms
            if (Object.keys(rooms[currentRoom].players).length === 0) {
                delete rooms[currentRoom];
                console.log(`Room ${currentRoom} deleted (empty)`);
            }
        }
        console.log(`[-] Disconnected: ${socket.id}`);
    });
});

server.listen(PORT, () => {
    console.log(`🎮 Game Server running on port ${PORT}`);
});
