class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.players = {};
        this.selfId = null;
        this.speed = 5;
        this.playerSize = 34; // Square dimensions
        this.keys = { up: false, down: false, left: false, right: false };
        this.isOffline = false; // Flag for solo/offline dev testing

        // Connect to your live Render server
        const SERVER_URL = 'https://multiplayer-l8xd.onrender.com';
        this.network = new NetworkManager(SERVER_URL);
        this.network.connect();

        this.setupUI();
        this.setupNetwork();
        this.setupInputs();

        requestAnimationFrame(() => this.loop());
    }

    setupUI() {
        const nameInput = document.getElementById('playerNameInput');
        const codeInput = document.getElementById('roomCodeInput');

        document.getElementById('createBtn').addEventListener('click', () => {
            const name = nameInput.value.trim() || 'Player';
            this.network.createRoom(name);
        });

        document.getElementById('joinBtn').addEventListener('click', () => {
            const code = codeInput.value.trim();
            if (!code) return alert('Please enter a 4-letter room code!');
            const name = nameInput.value.trim() || 'Player';
            this.network.joinRoom(code, name);
        });

        // 🕹️ Offline Solo Dev Mode
        document.getElementById('offlineBtn').addEventListener('click', () => {
            const name = nameInput.value.trim() || 'SoloDev';
            this.startOfflineMode(name);
        });
    }

    startOfflineMode(playerName) {
        this.isOffline = true;
        this.selfId = 'solo-player';

        // Spawn local player
        this.players[this.selfId] = {
            id: this.selfId,
            name: playerName,
            x: 400,
            y: 300,
            color: '#38bdf8'
        };

        // Spawn a dummy target bot for collision/testing
        this.players['training-bot'] = {
            id: 'training-bot',
            name: 'Training Bot',
            x: 250,
            y: 300,
            color: '#f43f5e'
        };

        // Switch to game canvas
        document.getElementById('lobbyScreen').style.display = 'none';
        document.getElementById('gameScreen').style.display = 'flex';
        document.getElementById('displayRoomCode').innerText = 'SOLO (DEV MODE)';
    }

    setupNetwork() {
        const createBtn = document.getElementById('createBtn');
        const joinBtn = document.getElementById('joinBtn');

        this.network.onConnected = () => {
            createBtn.disabled = false;
            joinBtn.disabled = false;
            createBtn.innerText = 'Create New Room (Online)';
        };

        this.network.onConnectError = () => {
            createBtn.innerText = 'Connecting / Waking server...';
        };

        this.network.onRoomJoined = (data) => {
            this.selfId = data.selfId;
            this.players = data.players;

            // Initialize target positions for smooth lerping
            for (const id in this.players) {
                this.players[id].targetX = this.players[id].x;
                this.players[id].targetY = this.players[id].y;
            }

            // Switch to game screen
            document.getElementById('lobbyScreen').style.display = 'none';
            document.getElementById('gameScreen').style.display = 'flex';
            document.getElementById('displayRoomCode').innerText = data.roomCode;
        };

        this.network.onPlayerJoined = (player) => {
            player.targetX = player.x;
            player.targetY = player.y;
            this.players[player.id] = player;
        };

        this.network.onPlayerMoved = (data) => {
            if (this.players[data.id]) {
                this.players[data.id].targetX = data.x;
                this.players[data.id].targetY = data.y;
            }
        };

        this.network.onPlayerLeft = (id) => {
            delete this.players[id];
        };

        this.network.onError = (msg) => {
            alert(msg);
        };
    }

    setupInputs() {
        window.addEventListener('keydown', (e) => {
            if (['KeyW', 'ArrowUp'].includes(e.code)) this.keys.up = true;
            if (['KeyS', 'ArrowDown'].includes(e.code)) this.keys.down = true;
            if (['KeyA', 'ArrowLeft'].includes(e.code)) this.keys.left = true;
            if (['KeyD', 'ArrowRight'].includes(e.code)) this.keys.right = true;
        });

        window.addEventListener('keyup', (e) => {
            if (['KeyW', 'ArrowUp'].includes(e.code)) this.keys.up = false;
            if (['KeyS', 'ArrowDown'].includes(e.code)) this.keys.down = false;
            if (['KeyA', 'ArrowLeft'].includes(e.code)) this.keys.left = false;
            if (['KeyD', 'ArrowRight'].includes(e.code)) this.keys.right = false;
        });
    }

    loop() {
        // 1. Move local player
        if (this.selfId && this.players[this.selfId]) {
            const me = this.players[this.selfId];
            let moved = false;
            const halfSize = this.playerSize / 2;

            if (this.keys.left && me.x > halfSize) { me.x -= this.speed; moved = true; }
            if (this.keys.right && me.x < this.canvas.width - halfSize) { me.x += this.speed; moved = true; }
            if (this.keys.up && me.y > halfSize) { me.y -= this.speed; moved = true; }
            if (this.keys.down && me.y < this.canvas.height - halfSize) { me.y += this.speed; moved = true; }

            if (moved && !this.isOffline) {
                this.network.sendMove(me.x, me.y);
            }
        }

        // 2. Interpolate other players (smooth movement)
        for (const id in this.players) {
            if (id !== this.selfId) {
                const p = this.players[id];
                if (p.targetX !== undefined && p.targetY !== undefined) {
                    p.x += (p.targetX - p.x) * 0.25;
                    p.y += (p.targetY - p.y) * 0.25;
                }
            }
        }

        // 3. Clear canvas & draw background grid
        this.ctx.fillStyle = '#0f172a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawGrid();

        // 4. Draw all players as squares
        for (const id in this.players) {
            const p = this.players[id];
            const isSelf = id === this.selfId;
            const s = this.playerSize;

            this.ctx.save();

            // Glow effect
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = p.color;

            // Draw Square Body
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);

            // Outline (Bright white for local player)
            this.ctx.lineWidth = isSelf ? 3 : 1.5;
            this.ctx.strokeStyle = isSelf ? '#ffffff' : '#00000066';
            this.ctx.strokeRect(p.x - s / 2, p.y - s / 2, s, s);

            this.ctx.restore();

            // Nametag
            this.ctx.font = 'bold 12px "Segoe UI", sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillStyle = isSelf ? '#38bdf8' : '#f8fafc';
            const label = isSelf ? `${p.name} (You)` : p.name;
            this.ctx.fillText(label, p.x, p.y - s / 2 - 8);
        }

        requestAnimationFrame(() => this.loop());
    }

    drawGrid() {
        this.ctx.strokeStyle = '#1e293b';
        this.ctx.lineWidth = 1;
        const size = 40;

        for (let x = 0; x < this.canvas.width; x += size) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        for (let y = 0; y < this.canvas.height; y += size) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new Game();
});
