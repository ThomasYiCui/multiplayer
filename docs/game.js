class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        this.ctx = this.canvas.getContext('2d');
        this.players = {};
        this.walls = [];
        this.selfId = null;

        this.keys = { up: false, down: false, left: false, right: false };
        this.mouseX = 0;
        this.mouseY = 0;
        this.clicked = false;
        this.dragged = false;
        this.isOffline = false;

        this.authMode = 'login'; // 'login' or 'register'
        this.currentUser = null;
        this.currentWorldName = '';

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
        const tabLogin = document.getElementById('tabLogin');
        const tabRegister = document.getElementById('tabRegister');
        const authSubmitBtn = document.getElementById('authSubmitBtn');
        const authError = document.getElementById('authError');
        const usernameInput = document.getElementById('authUsername');
        const passwordInput = document.getElementById('authPassword');

        // Tab Switching
        tabLogin.addEventListener('click', () => {
            this.authMode = 'login';
            tabLogin.classList.add('active');
            tabRegister.classList.remove('active');
            authSubmitBtn.innerText = 'Login';
            authError.style.display = 'none';
        });

        tabRegister.addEventListener('click', () => {
            this.authMode = 'register';
            tabRegister.classList.add('active');
            tabLogin.classList.remove('active');
            authSubmitBtn.innerText = 'Create Account';
            authError.style.display = 'none';
        });

        // Form Submit
        const submitAuth = () => {
            const username = usernameInput.value.trim();
            const password = passwordInput.value;

            if (!username) {
                this.showAuthError('Please enter a username.');
                return;
            }
            if (!password) {
                this.showAuthError('Please enter a password.');
                return;
            }

            authError.style.display = 'none';

            if (this.authMode === 'login') {
                this.network.login(username, password);
            } else {
                this.network.register(username, password);
            }
        };

        authSubmitBtn.addEventListener('click', submitAuth);
        passwordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitAuth();
        });
        usernameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitAuth();
        });

        // Offline Dev Mode
        document.getElementById('offlineBtn').addEventListener('click', () => {
            const name = usernameInput.value.trim() || 'SoloDev';
            this.startOfflineMode(name);
        });

        // Log Out
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.currentUser = null;
            this.showScreen('authScreen');
        });

        // Leave Realm
        document.getElementById('leaveWorldBtn').addEventListener('click', () => {
            this.leaveWorld();
        });
    }

    showAuthError(msg) {
        const authError = document.getElementById('authError');
        authError.innerText = msg;
        authError.style.display = 'block';
    }

    showScreen(screenId) {
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('worldScreen').style.display = 'none';
        document.getElementById('gameScreen').style.display = 'none';

        const target = document.getElementById(screenId);
        if (target) {
            target.style.display = 'flex';
        }
    }

    updateUserProfileUI(user) {
        if (!user) return;
        document.getElementById('headerUsername').innerText = user.username;
        document.getElementById('headerUserLevel').innerText = `Level ${user.level || 1}`;
        document.getElementById('headerUserGold').innerText = `${user.gold || 0} Gold`;

        document.getElementById('hudPlayerLevel').innerText = `Lv. ${user.level || 1}`;
        document.getElementById('hudGoldText').innerText = `${user.gold || 0} Gold`;

        const maxHp = user.maxHp || 100;
        const hp = user.hp !== undefined ? user.hp : 100;
        const hpRatio = Math.max(0, Math.min(1, hp / maxHp));
        document.getElementById('hudHpFill').style.width = `${hpRatio * 100}%`;
        document.getElementById('hudHpText').innerText = `${hp} / ${maxHp}`;
    }

    renderWorldsGrid(worlds) {
        const grid = document.getElementById('worldsGrid');
        if (!grid) return;

        if (!worlds || worlds.length === 0) {
            grid.innerHTML = '<div style="color: #94a3b8; text-align: center; grid-column: 1 / -1;">Connecting to servers...</div>';
            return;
        }

        const themes = {
            'world-1': 'theme-forest',
            'world-2': 'theme-volcano',
            'world-3': 'theme-ice'
        };

        grid.innerHTML = worlds.map(w => {
            const isFull = w.playerCount >= w.maxPlayers;
            const themeClass = themes[w.id] || 'theme-forest';

            return `
                <div class="world-card ${themeClass}">
                    <div class="world-theme-bar"></div>
                    <div>
                        <div class="world-card-title">${w.name}</div>
                    </div>
                    <div>
                        <div class="world-meta">
                            <span class="world-players-count">${w.playerCount} / ${w.maxPlayers} Players</span>
                            <span class="world-status-tag ${isFull ? 'full' : 'open'}">${isFull ? 'Full' : 'Open'}</span>
                        </div>
                        <button class="enter-world-btn" data-world-id="${w.id}" ${isFull ? 'disabled' : ''}>
                            ${isFull ? 'Server Full' : 'Join Server'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Attach click listeners to Join Server buttons
        grid.querySelectorAll('.enter-world-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const worldId = btn.getAttribute('data-world-id');
                this.network.joinWorld(worldId);
            });
        });
    }

    leaveWorld() {
        this.isOffline = false;
        this.players = {};
        this.selfId = null;
        this.network.leaveWorld();
        this.showScreen('worldScreen');
    }

    startOfflineMode(playerName) {
        this.isOffline = true;
        this.selfId = 'solo-player';
        this.currentUser = {
            username: playerName,
            level: 1,
            hp: 100,
            maxHp: 100,
            gold: 50
        };

        this.updateUserProfileUI(this.currentUser);
        document.getElementById('hudWorldName').innerText = 'Solo Practice Server';

        this.players[this.selfId] = new Player(400, 300, this.selfId, playerName, {
            isSelf: true,
            level: 1,
            hp: 100,
            maxHp: 100
        });

        this.players['training-dummy'] = new Player(250, 300, 'training-dummy', "Training Dummy", {
            isSelf: false,
            level: 1,
            hp: 80,
            maxHp: 80
        });

        this.showScreen('gameScreen');
    }

    setupNetwork() {
        this.network.onAuthSuccess = (user) => {
            this.currentUser = user;
            this.updateUserProfileUI(user);
            this.showScreen('worldScreen');
        };

        this.network.onAuthError = (msg) => {
            this.showAuthError(msg);
        };

        this.network.onWorldList = (worlds) => {
            this.renderWorldsGrid(worlds);
        };

        this.network.onWorldJoined = (data) => {
            this.selfId = data.selfId;
            this.currentUser = data.user;
            this.currentWorldName = data.worldName;
            this.players = {};

            document.getElementById('hudWorldName').innerText = data.worldName;
            this.updateUserProfileUI(data.user);

            for (const id in data.players) {
                const p = data.players[id];
                this.players[id] = new Player(p.x, p.y, p.id, p.name, {
                    isSelf: p.id === this.selfId,
                    level: p.level || 1,
                    hp: p.hp || 100,
                    maxHp: p.maxHp || 100,
                    gold: p.gold || 0,
                    color: p.color
                });
            }

            this.showScreen('gameScreen');
        };

        this.network.onPlayerJoined = (p) => {
            this.players[p.id] = new Player(p.x, p.y, p.id, p.name, {
                isSelf: false,
                level: p.level || 1,
                hp: p.hp || 100,
                maxHp: p.maxHp || 100,
                gold: p.gold || 0,
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
            const cRect = this.canvas.getBoundingClientRect();
            this.mouseX = Math.round(e.clientX - cRect.left);
            this.mouseY = Math.round(e.clientY - cRect.top);
        });

        window.addEventListener("mousedown", () => {
            this.dragged = true;
        }, false);

        window.addEventListener("mouseup", () => {
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

        // Render Walls
        for (const wall of this.walls) {
            wall.display(this.ctx);
        }

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
