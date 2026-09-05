class Player extends Character {
    constructor(x, y, id, playerName, opt = {}) {
        super(x, y, {
            maxHp: opt.maxHp !== undefined ? opt.maxHp : 100,
            hp: opt.hp !== undefined ? opt.hp : 100,
            speed: 300, // Pixels per second
            size: 20,
            color: opt.color || `rgb(${Math.round(Math.random() * 255)}, ${Math.round(Math.random() * 255)}, ${Math.round(Math.random() * 255)})`,
            regen: opt.regen || 0
        });

        this.id = id;
        this.playerName = playerName || 'Adventurer';
        this.isSelf = opt.isSelf || false;
        this.level = opt.level || 1;
        this.stamina = opt.stamina !== undefined ? opt.stamina : 100;
        this.maxStamina = opt.maxStamina !== undefined ? opt.maxStamina : 100;
        this.xp = opt.xp || 0;
        this.maxXp = opt.maxXp || (this.level * 100);
        this.gold = opt.gold || 0;

        this.weapon = new Weapon(this, "Iron Sword");
        this.r = 0;
        this.prevR = 0;
        this.mouseX = 0;
        this.mouseY = 0;
        this.targetX = x;
        this.targetY = y;

        // Network Snapshot Buffer for smooth interpolation
        this.snapshotBuffer = [];
        this.addSnapshot({ x, y, r: 0, mouseX: 0, mouseY: 0, time: Date.now() });
    }

    // Add timestamped network snapshot for remote interpolation
    addSnapshot(data) {
        const snap = {
            x: data.x,
            y: data.y,
            r: data.r !== undefined ? data.r : this.r,
            mouseX: data.mouseX !== undefined ? data.mouseX : this.mouseX,
            mouseY: data.mouseY !== undefined ? data.mouseY : this.mouseY,
            time: data.time || Date.now()
        };

        this.snapshotBuffer.push(snap);

        // Keep buffer trimmed to ~1.5s of snapshots
        const cutoff = Date.now() - 1500;
        while (this.snapshotBuffer.length > 2 && this.snapshotBuffer[0].time < cutoff) {
            this.snapshotBuffer.shift();
        }

        this.targetX = data.x;
        this.targetY = data.y;
        if (data.r !== undefined) this.targetR = data.r;
    }

    // Local / Offline Damage
    takeDamage(amount, attacker, contactX, contactY, game) {
        if (this.hp <= 0 || this.isDead || this.hitCooldown > 0) return;

        this.hp = Math.max(0, this.hp - amount);
        this.hitCooldown = 0.25; // 0.25s invulnerability
        this.hitFlash = 0.2;     // Flash bright red

        const pushAngle = attacker ? Math.atan2(this.y - attacker.y, this.x - attacker.x) : Math.random() * Math.PI * 2;

        // Spawn floating damage counter
        if (game && game.spawnDamageCounter) {
            game.spawnDamageCounter(this.x, this.y - this.size - 20, amount, '#ef4444');
        }

        if (this.hp <= 0) {
            this.isDead = true;
            if (game && game.spawnBlood) {
                game.spawnBlood(contactX || this.x, contactY || this.y, '#dc2626', 28, pushAngle, true);
            }

            // Dummy auto-respawn if defeated in offline mode
            if (this.id === 'training-dummy') {
                setTimeout(() => {
                    this.hp = this.maxHp;
                    this.isDead = false;
                    this.x = 250;
                    this.y = 300;
                    this.targetX = 250;
                    this.targetY = 300;
                    this.knockbackX = 0;
                    this.knockbackY = 0;
                }, 1500);
            } else if (this.id === 'solo-player') {
                setTimeout(() => {
                    this.hp = this.maxHp;
                    this.isDead = false;
                    this.x = 400;
                    this.y = 300;
                    this.knockbackX = 0;
                    this.knockbackY = 0;
                }, 1500);
            }
        } else {
            // Apply physical knockback velocity
            this.applyKnockback(pushAngle, 650);
            this.targetX = this.x + Math.cos(pushAngle) * 80;
            this.targetY = this.y + Math.sin(pushAngle) * 80;

            if (game && game.spawnBlood) {
                game.spawnBlood(contactX || this.x, contactY || this.y, '#dc2626', 10, pushAngle, false);
            }
        }
    }

    // Multiplayer Network Damage Handler
    onDamaged(damage, newHp, pushAngle, pushForce, newX, newY, attacker, game) {
        this.hp = newHp;
        this.hitFlash = 0.2;
        this.hitCooldown = 0.25;

        // Add floating damage counter
        if (game && game.spawnDamageCounter) {
            game.spawnDamageCounter(this.x, this.y - this.size - 20, damage, '#ef4444');
        }

        const angle = pushAngle !== undefined ? pushAngle : (attacker ? Math.atan2(this.y - attacker.y, this.x - attacker.x) : 0);

        if (this.hp <= 0) {
            this.isDead = true;
            if (game && game.spawnBlood) {
                game.spawnBlood(this.x, this.y, '#dc2626', 28, angle, true);
            }
        } else {
            // Apply smooth knockback impulse
            const force = pushForce || 650;
            this.applyKnockback(angle, force);

            if (game && game.spawnBlood) {
                game.spawnBlood(this.x, this.y, '#dc2626', 10, angle, false);
            }

            if (this.isSelf) {
                this.lastSyncTime = 0; // Force immediate broadcast of knocked position
            }
        }
    }

    display(ctx, game) {
        // DESPAWN: If player is at 0 HP or dead, hide body, weapon, and health bar completely
        if (this.hp <= 0 || this.isDead) {
            return;
        }

        ctx.save();

        // 1. Health Bar & Level Tag above head
        const barWidth = 44;
        const barHeight = 6;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.size - 20;

        // Health bar shadow / background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
        ctx.fillStyle = '#334155';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Health bar fill
        const hpRatio = Math.max(0, Math.min(1, this.hp / this.maxHp));
        ctx.fillStyle = hpRatio > 0.5 ? '#10b981' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444';
        ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);

        // Health bar border
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);

        // Level & Name Label
        ctx.font = 'bold 11px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3;
        const tag = `[Lv.${this.level}] ${this.playerName}${this.isSelf ? ' (You)' : ''}`;
        ctx.strokeText(tag, this.x, barY - 5);
        ctx.fillText(tag, this.x, barY - 5);

        // 2. Body Circle (Flashes bright red when taking damage)
        if (this.hitFlash > 0) {
            ctx.fillStyle = '#ef4444';
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 12;
        } else {
            ctx.fillStyle = 'rgb(252, 219, 154)';
            ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.size, this.size, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = this.hitFlash > 0 ? '#b91c1c' : '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.shadowBlur = 0;

        // 3. Render Equipped Weapon
        if (this.weapon) {
            this.weapon.display(ctx);
        }

        // 4. DEBUG HITBOXES: Visible collision circle and blade hitbox
        if (game && game.showHitboxes) {
            // Player collision circle (Green)
            ctx.strokeStyle = '#22c55e';
            ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Weapon blade hitbox capsule
            if (this.weapon && this.weapon.drawHitbox) {
                this.weapon.drawHitbox(ctx);
            }
        }

        ctx.restore();
    }

    update(input, game) {
        const dt = input.dt || 0.016;
        const moveDist = this.speed * dt;

        // General physics & health update from Character base
        this.updateGeneral(dt);

        // If player is dead, disable movement and combat
        if (this.hp <= 0 || this.isDead) {
            return;
        }

        if (this.isSelf) {
            let moved = false;
            if (input.keys["KeyA"] || input.keys["ArrowLeft"]) {
                this.x -= moveDist;
                moved = true;
            }
            if (input.keys["KeyD"] || input.keys["ArrowRight"]) {
                this.x += moveDist;
                moved = true;
            }
            if (input.keys["KeyW"] || input.keys["ArrowUp"]) {
                this.y -= moveDist;
                moved = true;
            }
            if (input.keys["KeyS"] || input.keys["ArrowDown"]) {
                this.y += moveDist;
                moved = true;
            }

            this.mouseX = input.mouse.x;
            this.mouseY = input.mouse.y;
            this.clicked = input.clicked;
            this.dragged = input.dragged;

            this.prevR = this.r;
            this.r = Math.atan2(this.y - this.mouseY, this.x - this.mouseX);

            // Wall collisions
            if (game && game.walls && Array.isArray(game.walls)) {
                for (const wall of game.walls) {
                    wall.resolveCollision(this);
                }
            }

            // ALWAYS ACTIVE COMBAT: Check weapon collision with other players / dummies
            if (this.weapon && game && game.players) {
                for (const id in game.players) {
                    if (id === this.id) continue;
                    const target = game.players[id];
                    if (target.hp <= 0 || target.isDead || target.hitCooldown > 0) continue;

                    const hitResult = this.weapon.checkHit(target);
                    if (hitResult && hitResult.hit) {
                        if (game.triggerScreenShake) {
                            game.triggerScreenShake(5);
                        }

                        const pushAngle = Math.atan2(target.y - this.y, target.x - this.x);
                        const pushForce = 650;

                        if (game.isOffline || target.id === 'training-dummy') {
                            // Offline / Solo Mode
                            target.takeDamage(hitResult.damage, this, hitResult.contactX, hitResult.contactY, game);
                        } else if (game.network) {
                            // Online Multiplayer: Immediate local visual response + network sync
                            target.hitCooldown = 0.25;
                            target.applyKnockback(pushAngle, pushForce);
                            if (game.spawnBlood) {
                                game.spawnBlood(hitResult.contactX, hitResult.contactY, '#dc2626', 10, pushAngle, false);
                            }
                            if (game.spawnDamageCounter) {
                                game.spawnDamageCounter(target.x, target.y - target.size - 20, hitResult.damage, '#ef4444');
                            }
                            target.hitFlash = 0.2;
                            game.network.sendHit(target.id, hitResult.damage, pushAngle, pushForce);
                        }
                    }
                }
            }

            // Check weapon collision with active Enemies
            if (this.weapon && game && game.enemies && Array.isArray(game.enemies)) {
                for (const enemy of game.enemies) {
                    if (enemy.hp <= 0 || enemy.isDead || enemy.hitCooldown > 0) continue;
                    const hitResult = this.weapon.checkHit(enemy);
                    if (hitResult && hitResult.hit) {
                        if (game.triggerScreenShake) game.triggerScreenShake(5);
                        const pushAngle = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                        const pushForce = 650;

                        if (game.isOffline) {
                            enemy.takeDamage(hitResult.damage, this, hitResult.contactX, hitResult.contactY, game);
                        } else if (game.network) {
                            // Instant local feedback + authoritative server broadcast
                            enemy.hitCooldown = 0.25;
                            enemy.applyKnockback(pushAngle, pushForce);
                            if (game.spawnBlood) {
                                game.spawnBlood(hitResult.contactX || enemy.x, hitResult.contactY || enemy.y, enemy.bloodColor || '#dc2626', 10, pushAngle, false);
                            }
                            if (game.spawnDamageCounter) {
                                game.spawnDamageCounter(enemy.x, enemy.y - enemy.size - 18, hitResult.damage, '#ef4444');
                            }
                            enemy.hitFlash = 0.2;
                            game.network.sendEnemyHit(enemy.id, hitResult.damage, pushAngle, pushForce);
                        }
                    }
                }
            }

            // Sync with multiplayer server
            if (game && !game.isOffline && game.network) {
                const now = performance.now();
                if (!this.lastSyncTime) this.lastSyncTime = 0;
                if (this.lastSentX === undefined) {
                    this.lastSentX = this.x;
                    this.lastSentY = this.y;
                    this.lastSentR = this.r;
                }

                const distChanged = Math.hypot(this.x - this.lastSentX, this.y - this.lastSentY) > 0.5;
                const rotChanged = Math.abs(this.r - this.lastSentR) > 0.01;

                if ((distChanged || rotChanged || Math.abs(this.knockbackX) > 2 || Math.abs(this.knockbackY) > 2) && (now - this.lastSyncTime > 30)) {
                    this.lastSyncTime = now;
                    this.lastSentX = this.x;
                    this.lastSentY = this.y;
                    this.lastSentR = this.r;
                    game.network.sendUpdate(this.x, this.y, this.r, this.mouseX, this.mouseY);
                }
            }
        }

        if (!this.isSelf) {
            // Training dummy does not interpolate from network
            if (this.id === 'training-dummy') {
                return;
            }
            // Timestamped Snapshot Interpolation
            const buffer = this.snapshotBuffer;
            if (buffer && buffer.length > 0) {
                const ping = (game && game.network && game.network.ping) ? game.network.ping : 50;
                const interpDelay = Math.max(50, Math.min(150, ping * 1.2));
                const renderTime = Date.now() - interpDelay;

                let s0 = null;
                let s1 = null;

                for (let i = buffer.length - 1; i >= 0; i--) {
                    if (buffer[i].time <= renderTime) {
                        s0 = buffer[i];
                        s1 = buffer[i + 1] || null;
                        break;
                    }
                }

                if (s0 && s1) {
                    const timeDelta = s1.time - s0.time;
                    const t = timeDelta > 0 ? Math.max(0, Math.min(1, (renderTime - s0.time) / timeDelta)) : 1;

                    this.x = s0.x + (s1.x - s0.x) * t;
                    this.y = s0.y + (s1.y - s0.y) * t;

                    let diff = (s1.r - s0.r) % (Math.PI * 2);
                    if (diff < -Math.PI) diff += Math.PI * 2;
                    if (diff > Math.PI) diff -= Math.PI * 2;
                    this.r = s0.r + diff * t;

                    this.mouseX = s0.mouseX + (s1.mouseX - s0.mouseX) * t;
                    this.mouseY = s0.mouseY + (s1.mouseY - s0.mouseY) * t;
                } else if (s0) {
                    const lerpRate = Math.min(1, 20 * dt);
                    this.x += (s0.x - this.x) * lerpRate;
                    this.y += (s0.y - this.y) * lerpRate;
                    let diff = (s0.r - this.r) % (Math.PI * 2);
                    if (diff < -Math.PI) diff += Math.PI * 2;
                    if (diff > Math.PI) diff -= Math.PI * 2;
                    this.r += diff * Math.min(1, 25 * dt);
                } else if (buffer.length > 0) {
                    const snap = buffer[0];
                    const lerpRate = Math.min(1, 20 * dt);
                    this.x += (snap.x - this.x) * lerpRate;
                    this.y += (snap.y - this.y) * lerpRate;
                }
            } else if (this.targetX !== undefined && this.targetY !== undefined) {
                const lerpRate = Math.min(1, 20 * dt);
                this.x += (this.targetX - this.x) * lerpRate;
                this.y += (this.targetY - this.y) * lerpRate;
                if (this.targetR !== undefined) {
                    let diff = (this.targetR - this.r) % (Math.PI * 2);
                    if (diff < -Math.PI) diff += Math.PI * 2;
                    if (diff > Math.PI) diff -= Math.PI * 2;
                    this.r += diff * Math.min(1, 25 * dt);
                }
            }
        }
    }
}