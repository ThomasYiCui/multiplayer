class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.canvas.width = window.innerWidth
        this.canvas.height = window.innerHeight


        this.ctx = this.canvas.getContext('2d');
        this.players = {};
        this.selfId = null;

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
            this.players = data.players;

            for (const id in this.players) {
                this.players[id].targetX = this.players[id].x;
                this.players[id].targetY = this.players[id].y;
            }

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
            this.keys[e.code] = true;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    loop() {
        for (const id in this.players) {
            const player = this.players[id]
            player.update(this.keys)
        }

        this.ctx.fillStyle = '#0f172a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawGrid();

        for (const id in this.players) {
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
