const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

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

    // 4. DISCONNECT / LEAVE
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
