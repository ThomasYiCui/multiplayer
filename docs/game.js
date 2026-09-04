class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.canvas.width = window.innerWidth
        this.canvas.height = window.innerHeight


        this.ctx = this.canvas.getContext('2d');
        this.players = {};
        this.selfId = null;
        this.speed = 5;
        this.playerSize = 34;
        this.keys = { up: false, down: false, left: false, right: false };
        this.isOffline = false;

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
        this.players[this.selfId] = new Player(400, 300, this.selfId, playerName,
            {
                isSelf: true,
            }
        )

        // Spawn a dummy target bot for collision/testing
        this.players['training-bot'] = new Player(250, 300, 'training-bot', "Training Bot",
            {
                isSelf: false,
            }
        )

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
            this.players = {};

            // Instantiate Player objects for all players currently in the room
            for (const id in data.players) {
                const p = data.players[id];
                this.players[id] = new Player(p.x, p.y, p.id, p.name, {
                    isSelf: p.id === this.selfId,
                    color: p.color
                });
            }

            document.getElementById('lobbyScreen').style.display = 'none';
            document.getElementById('gameScreen').style.display = 'flex';
            document.getElementById('displayRoomCode').innerText = data.roomCode;
        };

        this.network.onPlayerJoined = (p) => {
            // Instantiate Player object for newly joined remote player
            this.players[p.id] = new Player(p.x, p.y, p.id, p.name, {
                isSelf: false,
                color: p.color
            });
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
        if (this.selfId && this.players[this.selfId]) {
            const me = this.players[this.selfId];
            let moved = false;

            if (this.keys.left && me.x > 0) { me.x -= me.speed; moved = true; }
            if (this.keys.right && me.x < this.canvas.width - me.size) { me.x += me.speed; moved = true; }
            if (this.keys.up && me.y > 0) { me.y -= me.speed; moved = true; }
            if (this.keys.down && me.y < this.canvas.height - me.size) { me.y += me.speed; moved = true; }

            if (moved && !this.isOffline) {
                this.network.sendMove(me.x, me.y);
            }
        }

        for (const id in this.players) {
            if (id !== this.selfId) {
                const p = this.players[id];
                if (p.targetX !== undefined && p.targetY !== undefined) {
                    p.x += (p.targetX - p.x) * 0.25;
                    p.y += (p.targetY - p.y) * 0.25;
                }
            }
        }

        this.ctx.fillStyle = '#0f172a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawGrid();

        for (const id in this.players) {
            const p = this.players[id];
            const isSelf = id === this.selfId;
            const s = this.playerSize;

            this.players[id].display(this.ctx)
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
