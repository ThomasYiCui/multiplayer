class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        this.ctx = this.canvas.getContext('2d');
        this.players = {};
        this.enemies = [];
        this.walls = [];
        this.particles = [];
        this.damageCounters = [];
        this.selfId = null;

        this.keys = { up: false, down: false, left: false, right: false };
        this.mouseX = 0;
        this.mouseY = 0;
        this.clicked = false;
        this.dragged = false;
        this.isOffline = false;
        this.showHitboxes = true;
        this.isEscapeMenuOpen = false;

        this.camera = {
            x: 0,
            y: 0,
        }

        this.authMode = 'login'; // 'login' or 'register'
        this.currentUser = null;
        this.currentWorldName = '';

        const SERVER_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:3000'
            : 'https://multiplayer-l8xd.onrender.com';
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

        // Leave Realm / Server buttons
        document.querySelectorAll('#leaveWorldBtn, .leave-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.leaveWorld();
            });
        });

        // Escape Menu: Resume Game
        const resumeBtn = document.getElementById('escapeResumeBtn');
        if (resumeBtn) {
            resumeBtn.addEventListener('click', () => {
                this.toggleEscapeMenu(false);
            });
        }

        // Hitbox Toggle Buttons (HUD & Escape Menu)
        const toggleHitboxBtn = document.getElementById('toggleHitboxBtn');
        if (toggleHitboxBtn) {
            toggleHitboxBtn.addEventListener('click', () => {
                this.toggleHitboxes();
            });
        }

        const escapeHitboxBtn = document.getElementById('escapeHitboxBtn');
        if (escapeHitboxBtn) {
            escapeHitboxBtn.addEventListener('click', () => {
                this.toggleHitboxes();
            });
        }
    }

    toggleHitboxes() {
        this.showHitboxes = !this.showHitboxes;
        const text = this.showHitboxes ? 'Hitboxes: ON [H]' : 'Hitboxes: OFF [H]';
        const bg = this.showHitboxes ? '#065f46' : '#334155';
        const border = this.showHitboxes ? '#059669' : '#475569';

        const hudBtn = document.getElementById('toggleHitboxBtn');
        if (hudBtn) {
            hudBtn.innerText = text;
            hudBtn.style.background = bg;
            hudBtn.style.borderColor = border;
        }

        const escapeBtn = document.getElementById('escapeHitboxBtn');
        if (escapeBtn) {
            escapeBtn.innerText = text;
            escapeBtn.style.background = bg;
            escapeBtn.style.borderColor = border;
        }
    }

    toggleEscapeMenu(forceState) {
        this.isEscapeMenuOpen = forceState !== undefined ? forceState : !this.isEscapeMenuOpen;
        const menu = document.getElementById('escapeMenu');
        if (menu) {
            menu.style.display = this.isEscapeMenuOpen ? 'flex' : 'none';
        }

        if (this.isEscapeMenuOpen) {
            const serverNameElem = document.getElementById('escapeServerName');
            if (serverNameElem) {
                serverNameElem.innerText = this.currentWorldName || (this.isOffline ? 'Solo Practice Server' : 'Multiplayer Realm');
            }
        }
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

        const nameElem = document.getElementById('hudPlayerName');
        if (nameElem) nameElem.innerText = user.playerName || user.username || 'Adventurer';

        const lvlElem = document.getElementById('hudPlayerLevel');
        if (lvlElem) lvlElem.innerText = `Lv. ${user.level || 1}`;

        const goldElem = document.getElementById('hudGoldText');
        if (goldElem) goldElem.innerText = `${user.gold || 0} Gold`;

        // 1. Health Bar
        const maxHp = user.maxHp || 100;
        const hp = user.hp !== undefined ? Math.max(0, user.hp) : 100;
        const hpRatio = Math.max(0, Math.min(1, hp / maxHp));
        const hpFill = document.getElementById('hudHpFill');
        if (hpFill) {
            hpFill.style.width = `${hpRatio * 100}%`;
            hpFill.style.background = hpRatio > 0.5 ? '#10b981' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444';
        }
        const hpText = document.getElementById('hudHpText');
        if (hpText) hpText.innerText = `${Math.round(hp)} / ${maxHp}`;

        // 2. Stamina Bar
        const maxStamina = user.maxStamina || 100;
        const stamina = user.stamina !== undefined ? Math.max(0, user.stamina) : 100;
        const staRatio = Math.max(0, Math.min(1, stamina / maxStamina));
        const staminaFill = document.getElementById('hudStaminaFill');
        if (staminaFill) staminaFill.style.width = `${staRatio * 100}%`;
        const staminaText = document.getElementById('hudStaminaText');
        if (staminaText) staminaText.innerText = `${Math.round(stamina)} / ${maxStamina}`;

        // 3. EXP Bar
        const level = user.level || 1;
        const maxXp = user.maxXp || (level * 100);
        const xp = user.xp || 0;
        const xpRatio = Math.max(0, Math.min(1, xp / maxXp));
        const expFill = document.getElementById('hudExpFill');
        if (expFill) expFill.style.width = `${xpRatio * 100}%`;
        const expText = document.getElementById('hudExpText');
        if (expText) expText.innerText = `${xp} / ${maxXp} XP`;

        // Header User Info in World Select
        const headerName = document.getElementById('headerUsername');
        if (headerName) headerName.innerText = user.username || user.playerName || 'Adventurer';
        const headerLevel = document.getElementById('headerUserLevel');
        if (headerLevel) headerLevel.innerText = `Level ${user.level || 1}`;
        const headerGold = document.getElementById('headerUserGold');
        if (headerGold) headerGold.innerText = `${user.gold || 0} Gold`;
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
        this.toggleEscapeMenu(false);
        this.isOffline = false;
        this.players = {};
        this.enemies = [];
        this.particles = [];
        this.damageCounters = [];
        this.selfId = null;
        this.currentWorldName = '';
        this.network.leaveWorld();
        this.showScreen('worldScreen');
    }

    startOfflineMode(playerName) {
        this.toggleEscapeMenu(false);
        this.isOffline = true;
        this.currentWorldName = 'Solo Practice Server';
        this.selfId = 'solo-player';
        this.currentUser = {
            username: playerName,
            level: 1,
            hp: 100,
            maxHp: 100,
            gold: 50
        };

        const serverNameElem = document.getElementById('escapeServerName');
        if (serverNameElem) serverNameElem.innerText = 'Solo Practice Server';

        this.players[this.selfId] = new Player(400, 300, this.selfId, playerName, {
            isSelf: true,
            level: 1,
            hp: 100,
            maxHp: 100,
            gold: 50
        });

        // Offline Training Dummy
        this.players['training-dummy'] = new Player(250, 300, 'training-dummy', "Training Dummy", {
            isSelf: false,
            level: 1,
            hp: 80,
            maxHp: 80
        });

        // Spawn themed enemy groups across different sectors of the map
        this.enemies = [];

        // 1. Slime Nest (East forest clearing - 4 Bouncing Slimes)
        this.spawnEnemyGroup("Slime", 4, 720, 180, 85);

        // 2. Goblin Camp (South-East ruins - 3 Goblins with Cleavers)
        this.spawnEnemyGroup("Goblin", 3, 760, 580, 75);

        // 3. Skeleton Crypt (South-West dungeon - 3 Skeleton Warriors with Bone Swords)
        this.spawnEnemyGroup("Skeleton", 3, -160, 520, 80);

        // 4. Orc Outpost (North-West mountain - 1 Orc Berserker + 2 Goblins)
        this.spawnEnemyGroup("Orc", 1, -220, -120, 0);
        this.spawnEnemyGroup("Goblin", 2, -180, -90, 60);

        this.updateUserProfileUI(this.players[this.selfId]);
        this.showScreen('gameScreen');
    }

    spawnEnemyGroup(type, count, centerX, centerY, spread = 70) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * spread;
            const x = centerX + Math.cos(angle) * dist;
            const y = centerY + Math.sin(angle) * dist;
            this.enemies.push(Enemy.create(type, x, y));
        }
    }

    triggerScreenShake(amount = 5) {
        this.screenShake = Math.max(this.screenShake || 0, amount);
    }

    spawnBlood(x, y, color = '#dc2626', count = 10, angle = null, isDeath = false) {
        if (typeof Particle === 'undefined') return;
        const baseAngle = angle !== null && angle !== undefined ? angle : Math.random() * Math.PI * 2;
        for (let i = 0; i < count; i++) {
            const spreadAngle = isDeath ? Math.random() * Math.PI * 2 : baseAngle + (Math.random() - 0.5) * 1.6;
            const speed = isDeath ? Math.random() * 4.5 + 1.5 : Math.random() * 3.5 + 1.5;
            const life = isDeath ? Math.random() * 0.35 + 0.3 : Math.random() * 0.22 + 0.2;
            const size = isDeath ? Math.random() * 4 + 2.5 : Math.random() * 3 + 1.5;

            this.particles.push(new Particle(x, y, life, {
                vX: Math.cos(spreadAngle) * speed,
                vY: Math.sin(spreadAngle) * speed,
                drag: 0.94,
                gravity: 0.12,
                color: color,
                size: size,
                transparencyStart: 1.0,
                transparencyEnd: 0.0
            }));
        }
    }

    spawnDamageCounter(x, y, amount, color = '#ef4444') {
        if (typeof DamageCounter === 'undefined') return;
        this.damageCounters.push(new DamageCounter(x, y, amount, { color }));
    }

    setupNetwork() {
        this.network.onAuthSuccess = (user) => {
            this.currentUser = user;
            this.updateUserProfileUI(user);
            this.showScreen('worldScreen');
        };

        this.network.onUserStatsUpdate = (user) => {
            this.currentUser = user;
            if (this.players && this.selfId && this.players[this.selfId]) {
                const p = this.players[this.selfId];
                p.level = user.level || p.level;
                p.xp = user.xp || 0;
                p.maxXp = (user.level || 1) * 100;
                p.gold = user.gold || 0;
                p.hp = user.hp !== undefined ? user.hp : p.hp;
                p.maxHp = user.maxHp || p.maxHp;
            }
            this.updateUserProfileUI(user);
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

            const serverNameElem = document.getElementById('escapeServerName');
            if (serverNameElem) serverNameElem.innerText = data.worldName;

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

            // Instantiate Server-Synchronized Enemies
            this.enemies = [];
            if (data.enemies && Array.isArray(data.enemies)) {
                for (const e of data.enemies) {
                    if (e.isDead) continue;
                    const enemy = Enemy.create(e.type, e.x, e.y, { id: e.id, level: e.level });
                    enemy.hp = e.hp;
                    enemy.maxHp = e.maxHp;
                    if (enemy.addSnapshot) {
                        enemy.addSnapshot({ x: e.x, y: e.y, r: 0, hp: e.hp, maxHp: e.maxHp, time: Date.now() });
                    }
                    this.enemies.push(enemy);
                }
            }

            if (this.players[this.selfId]) {
                this.updateUserProfileUI(this.players[this.selfId]);
            }
            this.showScreen('gameScreen');
        };

        this.network.onEnemiesUpdate = (data) => {
            if (!data || !data.enemies || this.isOffline) return;
            const now = data.time || Date.now();
            for (const snap of data.enemies) {
                let enemy = this.enemies.find(e => e.id === snap.id);
                if (!enemy && !snap.isDead) {
                    enemy = Enemy.create(snap.type, snap.x, snap.y, { id: snap.id });
                    this.enemies.push(enemy);
                }
                if (enemy) {
                    if (enemy.addSnapshot) {
                        enemy.addSnapshot({
                            x: snap.x,
                            y: snap.y,
                            r: snap.r,
                            hp: snap.hp,
                            maxHp: snap.maxHp,
                            isAttacking: snap.isAttacking,
                            isDead: snap.isDead,
                            time: now
                        });
                    } else {
                        enemy.x = snap.x;
                        enemy.y = snap.y;
                        enemy.r = snap.r;
                        enemy.hp = snap.hp;
                        enemy.isDead = snap.isDead;
                    }
                }
            }
        };

        this.network.onEnemyDamaged = (data) => {
            const enemy = this.enemies.find(e => e.id === data.enemyId);
            if (enemy) {
                if (enemy.onServerDamaged) {
                    enemy.onServerDamaged(data.damage, data.hp, data.pushAngle, data.pushForce, data.attackerId, this);
                } else {
                    enemy.hp = data.hp;
                    this.spawnDamageCounter(enemy.x, enemy.y - enemy.size - 18, data.damage, '#ef4444');
                }
            }
        };

        this.network.onEnemyDied = (data) => {
            const idx = this.enemies.findIndex(e => e.id === data.enemyId);
            if (idx !== -1) {
                const enemy = this.enemies[idx];
                enemy.isDead = true;
                this.spawnBlood(enemy.x, enemy.y, enemy.bloodColor || '#dc2626', 26, Math.random() * Math.PI * 2, true);
                this.enemies.splice(idx, 1);
            }
        };

        this.network.onEnemySpawned = (data) => {
            let existing = this.enemies.find(e => e.id === data.id);
            if (existing) {
                existing.hp = data.hp;
                existing.maxHp = data.maxHp;
                existing.x = data.x;
                existing.y = data.y;
                existing.isDead = false;
                if (existing.addSnapshot) {
                    existing.addSnapshot({ x: data.x, y: data.y, r: 0, hp: data.hp, maxHp: data.maxHp, time: Date.now() });
                }
            } else {
                const newEnemy = Enemy.create(data.type, data.x, data.y, { id: data.id, level: data.level });
                newEnemy.hp = data.hp;
                newEnemy.maxHp = data.maxHp;
                if (newEnemy.addSnapshot) {
                    newEnemy.addSnapshot({ x: data.x, y: data.y, r: 0, hp: data.hp, maxHp: data.maxHp, time: Date.now() });
                }
                this.enemies.push(newEnemy);
            }
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

        this.network.onPingUpdate = (ping) => {
            const pingElem = document.getElementById('hudPing');
            if (pingElem) {
                pingElem.innerText = `${ping} ms`;
                if (ping < 65) {
                    pingElem.style.color = '#34d399';
                } else if (ping < 130) {
                    pingElem.style.color = '#fbbf24';
                } else {
                    pingElem.style.color = '#f87171';
                }
            }
        };

        this.network.onPlayerUpdate = (data) => {
            const player = this.players[data.id];
            if (player) {
                if (player.addSnapshot) {
                    player.addSnapshot(data);
                } else {
                    player.targetX = data.x;
                    player.targetY = data.y;
                    player.targetR = data.r;
                    player.mouseX = data.mouseX;
                    player.mouseY = data.mouseY;
                }
            }
        };

        this.network.onPlayerMoved = (data) => {
            const player = this.players[data.id];
            if (player) {
                if (player.addSnapshot) {
                    player.addSnapshot({ x: data.x, y: data.y, time: data.time });
                } else {
                    player.targetX = data.x;
                    player.targetY = data.y;
                }
            }
        };

        this.network.onPlayerMouse = (data) => {
            const player = this.players[data.id];
            if (player) {
                player.mouseX = data.mouseX;
                player.mouseY = data.mouseY;
                if (data.r !== undefined) {
                    player.targetR = data.r;
                    player.r = data.r;
                }
                player.clicked = data.clicked;
                player.dragged = data.dragged;
                if (player.addSnapshot && player.x !== undefined) {
                    player.addSnapshot({ x: player.x, y: player.y, r: data.r, mouseX: data.mouseX, mouseY: data.mouseY, time: data.time });
                }
            }
        };

        this.network.onPlayerLeft = (id) => {
            delete this.players[id];
        };

        this.network.onPlayerDamaged = (data) => {
            const target = this.players[data.targetId];
            const attacker = this.players[data.attackerId];

            if (target) {
                target.onDamaged(data.damage, data.hp, data.pushAngle, data.pushForce, data.newX, data.newY, attacker);

                // If self was damaged, trigger heavy screen shake and update HUD
                if (data.targetId === this.selfId) {
                    this.triggerScreenShake(12);
                    this.updateUserProfileUI({
                        username: target.playerName,
                        level: target.level,
                        hp: data.hp,
                        maxHp: target.maxHp,
                        gold: target.gold
                    });
                }
            }
        };

        this.network.onPlayerRespawned = (data) => {
            const player = this.players[data.id];
            if (player) {
                player.isDead = false;
                player.hp = data.hp;
                player.x = data.x;
                player.y = data.y;
                player.targetX = data.x;
                player.targetY = data.y;
                player.knockbackX = 0;
                player.knockbackY = 0;

                if (data.id === this.selfId) {
                    this.updateUserProfileUI({
                        username: player.playerName,
                        level: player.level,
                        hp: player.hp,
                        maxHp: player.maxHp,
                        gold: player.gold
                    });
                }
            }
        };

        this.network.onError = (msg) => {
            alert(msg);
        };
    }

    triggerScreenShake(amount = 5) {
        this.screenShake = Math.max(this.screenShake || 0, amount);
    }

    setupInputs() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;

            // Toggle escape menu on 'Escape' key
            if (e.code === 'Escape') {
                const gameScreen = document.getElementById('gameScreen');
                if (gameScreen && gameScreen.style.display !== 'none') {
                    this.toggleEscapeMenu();
                }
            }

            // Toggle hitboxes on 'H' key
            if (e.code === 'KeyH') {
                this.toggleHitboxes();
            }
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

        // Smooth camera follow target (self player)
        const selfPlayer = this.players[this.selfId];
        if (selfPlayer) {
            this.updateUserProfileUI(selfPlayer);
            const targetCamX = selfPlayer.x - this.canvas.width / 2;
            const targetCamY = selfPlayer.y - this.canvas.height / 2;
            const lerpRate = Math.min(1, 10 * dt);
            this.camera.x += (targetCamX - this.camera.x) * lerpRate;
            this.camera.y += (targetCamY - this.camera.y) * lerpRate;
        }

        // Convert screen mouse position to in-game world position
        const worldMouseX = this.mouseX + this.camera.x;
        const worldMouseY = this.mouseY + this.camera.y;

        for (const id in this.players) {
            const player = this.players[id];
            player.update(
                {
                    dt: dt,
                    keys: this.keys,
                    clicked: this.clicked,
                    dragged: this.dragged,
                    mouse: {
                        x: worldMouseX,
                        y: worldMouseY,
                    }
                }, this);
        }

        // Update Active Enemies
        if (this.enemies && Array.isArray(this.enemies)) {
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const enemy = this.enemies[i];
                enemy.update(dt, this);
                if (enemy.isDead) {
                    this.enemies.splice(i, 1);
                }
            }
        }

        // Update Particles
        if (this.particles && Array.isArray(this.particles)) {
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i];
                if (p.update) p.update(dt);
                const dead = typeof p.isDead === 'function' ? p.isDead() : (p.life <= 0 || p.transparency <= 0);
                if (dead) {
                    this.particles.splice(i, 1);
                }
            }
        }

        // Update Damage Counters
        if (this.damageCounters && Array.isArray(this.damageCounters)) {
            for (let i = this.damageCounters.length - 1; i >= 0; i--) {
                const dc = this.damageCounters[i];
                if (dc.update) dc.update(dt);
                const dead = typeof dc.isDead === 'function' ? dc.isDead() : (dc.life <= 0 || dc.alpha <= 0);
                if (dead) {
                    this.damageCounters.splice(i, 1);
                }
            }
        }

        this.clicked = false;

        // Clear canvas
        this.ctx.fillStyle = '#0f172a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Screen Shake calculation
        let shakeX = 0;
        let shakeY = 0;
        if (this.screenShake && this.screenShake > 0) {
            shakeX = (Math.random() - 0.5) * this.screenShake * 2;
            shakeY = (Math.random() - 0.5) * this.screenShake * 2;
            this.screenShake = Math.max(0, this.screenShake - dt * 25);
        }

        // Apply camera offset transformation with shake
        this.ctx.save();
        this.ctx.translate(-Math.round(this.camera.x + shakeX), -Math.round(this.camera.y + shakeY));

        this.drawGrid();

        // Render Walls
        for (const wall of this.walls) {
            wall.display(this.ctx);
        }

        // Render Particles (Ground level & blood splatters)
        if (this.particles && Array.isArray(this.particles)) {
            for (const p of this.particles) {
                p.display(this.ctx);
            }
        }

        // Render Enemies
        if (this.enemies && Array.isArray(this.enemies)) {
            for (const enemy of this.enemies) {
                enemy.display(this.ctx, this);
            }
        }

        // Render Players
        for (const id in this.players) {
            this.players[id].display(this.ctx, this);
        }

        // Render Floating Damage Counters (Top Layer)
        if (this.damageCounters && Array.isArray(this.damageCounters)) {
            for (const dc of this.damageCounters) {
                dc.display(this.ctx);
            }
        }

        this.ctx.restore();

        requestAnimationFrame((t) => this.loop(t));
    }

    drawGrid() {
        this.ctx.strokeStyle = '#1e293b';
        this.ctx.lineWidth = 1;
        const size = 40;

        const startX = Math.floor(this.camera.x / size) * size - size;
        const endX = startX + this.canvas.width + size * 2;
        const startY = Math.floor(this.camera.y / size) * size - size;
        const endY = startY + this.canvas.height + size * 2;

        for (let x = startX; x <= endX; x += size) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x, endY);
            this.ctx.stroke();
        }
        for (let y = startY; y <= endY; y += size) {
            this.ctx.beginPath();
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(endX, y);
            this.ctx.stroke();
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new Game();
});
