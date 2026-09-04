class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.canvas.width = window.innerWidth
        this.canvas.height = window.innerHeight


        this.ctx = this.canvas.getContext('2d');
        this.players = {};
        this.selfId = null;

        this.keys = { up: false, down: false, left: false, right: false };
        this.mouseX = 0;
        this.mouseY = 0;
        this.clicked = false;
        this.dragged = false;
        this.isOffline = false;

        const SERVER_URL = 'https://multiplayer-l8xd.onrender.com';
        this.network = new NetworkManager(SERVER_URL);
        this.network.connect();

        this.setupUI();
        this.setupNetwork();
        this.setupInputs();

        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    setupUI() {
        const nameInput = document.getElementById('playerNameInput');
        const lobbyNameInput = document.getElementById('lobbyNameInput');

        document.getElementById('quickPlayBtn').addEventListener('click', () => {
            const name = nameInput.value.trim() || 'Player';
            this.network.quickPlay(name);
        });

        document.getElementById('createLobbyBtn').addEventListener('click', () => {
            const name = nameInput.value.trim() || 'Player';
            const lobbyName = lobbyNameInput.value.trim();
            this.network.createLobby(lobbyName, name);
        });

        document.getElementById('offlineBtn').addEventListener('click', () => {
            const name = nameInput.value.trim() || 'SoloDev';
            this.startOfflineMode(name);
        });

        document.getElementById('leaveBtn').addEventListener('click', () => {
            this.leaveGame();
        });
    }

    renderLobbyList(lobbies) {
        const container = document.getElementById('lobbiesContainer');
        if (!container) return;
        const nameInput = document.getElementById('playerNameInput');

        if (!lobbies || lobbies.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: #64748b; font-size: 13px; padding: 14px;">No active lobbies. Click <strong>Quick Play</strong> or <strong>Host Lobby</strong> to start!</div>`;
            return;
        }

        container.innerHTML = '';
        lobbies.forEach(lobby => {
            const item = document.createElement('div');
            item.className = 'lobby-item';
            item.innerHTML = `
                <div>
                    <span class="lobby-name">${lobby.name}</span>
                    <span class="lobby-badge">${lobby.playerCount} / ${lobby.maxPlayers} Players</span>
                </div>
                <button class="join-lobby-btn">Join</button>
            `;
            item.querySelector('button').addEventListener('click', () => {
                const name = nameInput.value.trim() || 'Player';
                this.network.joinLobby(lobby.id, name);
            });
            container.appendChild(item);
        });
    }

    leaveGame() {
        this.isOffline = false;
        this.players = {};
        this.selfId = null;
        this.network.leaveLobby();

        document.getElementById('gameScreen').style.display = 'none';
        document.getElementById('lobbyScreen').style.display = 'flex';
    }

    startOfflineMode(playerName) {
        this.isOffline = true;
        this.selfId = 'solo-player';

        this.players[this.selfId] = new Player(400, 300, this.selfId, playerName, {
            isSelf: true,
        });

        this.players['training-bot'] = new Player(250, 300, 'training-bot', "Training Bot", {
            isSelf: false,
        });

        document.getElementById('lobbyScreen').style.display = 'none';
        document.getElementById('gameScreen').style.display = 'flex';
        document.getElementById('displayRoomCode').innerText = 'SOLO (OFFLINE)';
    }

    setupNetwork() {
        const quickPlayBtn = document.getElementById('quickPlayBtn');

        this.network.onConnected = () => {
            quickPlayBtn.innerText = 'Quick Play (Join World)';
        };

        this.network.onConnectError = () => {
            quickPlayBtn.innerText = 'Connecting / Waking server...';
        };

        this.network.onLobbyList = (lobbies) => {
            this.renderLobbyList(lobbies);
        };

        this.network.onRoomJoined = (data) => {
            this.selfId = data.selfId;
            this.players = {};

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

        this.network.onPlayerMouse = (data) => {
            if (this.players[data.id]) {
                this.players[data.id].mouseX = data.mouseX;
                this.players[data.id].mouseY = data.mouseY;
                if (data.r !== undefined) {
                    this.players[data.id].r = data.r;
                }
                this.players[data.id].clicked = data.clicked;
                this.players[data.id].dragged = data.dragged;
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

        const resize = () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resize);
        resize();

        window.addEventListener("mousemove", (e) => {
            var cRect = this.canvas.getBoundingClientRect();
            this.mouseX = Math.round(e.clientX - cRect.left);
            this.mouseY = Math.round(e.clientY - cRect.top);
        });

        window.addEventListener("mousedown", (e) => {
            this.dragged = true;
        }, false);

        window.addEventListener("mouseup", (e) => {
            if (this.dragged === true) {
                this.clicked = true;
                this.dragged = false;
            }
        }, false);
    }

    loop(timestamp = performance.now()) {
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
        this.lastTime = timestamp;

        for (const id in this.players) {
            const player = this.players[id];
            player.update(
                {
                    dt: dt,
                    keys: this.keys,
                    clicked: this.clicked,
                    dragged: this.dragged,
                    mouse: {
                        x: this.mouseX,
                        y: this.mouseY,
                    }
                }, this);
        }

        this.clicked = false;

        this.ctx.fillStyle = '#0f172a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawGrid();

        for (const id in this.players) {
            this.players[id].display(this.ctx);
        }

        requestAnimationFrame((t) => this.loop(t));
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
