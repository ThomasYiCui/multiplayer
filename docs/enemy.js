class Enemy extends Character {
    constructor(x, y, stats = {}, options = {}) {
        super(x, y, {
            maxHp: stats.maxHp || stats.hp || 50,
            hp: stats.hp || 50,
            speed: stats.speed || 100,
            size: stats.size || 18,
            color: stats.color || '#64748b',
            regen: stats.regen || 0
        });

        this.id = options.id || 'enemy_' + Math.random().toString(36).substr(2, 9);
        this.name = stats.name || 'Enemy';
        this.level = options.level || stats.level || 1;
        this.damage = stats.damage || 10;
        this.bloodColor = stats.bloodColor || '#dc2626';
        this.xpReward = stats.xpReward || 20;
        this.goldReward = stats.goldReward || 5;
        this.aggroRadius = stats.aggroRadius || 250;
        this.attackInterval = stats.attackInterval || 1.0;

        // AI & Combat State
        this.r = 0;
        this.attackCooldownTimer = Math.random() * 0.4;
        this.attackSwingTimer = 0;
        this.isAttacking = false;

        // Roaming Anchor
        this.spawnX = x;
        this.spawnY = y;
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.wanderTimer = Math.random() * 2 + 1.5;

        // Network Snapshot Interpolation Buffer
        this.snapshotBuffer = [];
        this.addSnapshot({ x, y, r: 0, hp: this.hp, maxHp: this.maxHp, time: Date.now() });
    }

    addSnapshot(data) {
        const snap = {
            x: data.x,
            y: data.y,
            r: data.r !== undefined ? data.r : this.r,
            hp: data.hp !== undefined ? data.hp : this.hp,
            maxHp: data.maxHp !== undefined ? data.maxHp : this.maxHp,
            isAttacking: data.isAttacking || false,
            isDead: data.isDead || false,
            time: data.time || Date.now()
        };

        this.snapshotBuffer.push(snap);

        const cutoff = Date.now() - 1500;
        while (this.snapshotBuffer.length > 2 && this.snapshotBuffer[0].time < cutoff) {
            this.snapshotBuffer.shift();
        }

        this.targetX = data.x;
        this.targetY = data.y;
        if (data.r !== undefined) this.targetR = data.r;
        if (data.hp !== undefined) this.hp = data.hp;
        if (data.maxHp !== undefined) this.maxHp = data.maxHp;
        this.isAttacking = data.isAttacking || false;
        this.isDead = data.isDead || false;
    }

    updateNetworkInterpolation(dt, game) {
        // If enemy is currently undergoing active local knockback impulse, don't let historical snapshots overwrite it!
        const isKnocked = Math.abs(this.knockbackX) > 2 || Math.abs(this.knockbackY) > 2;
        if (isKnocked) {
            // Keep the latest snapshot anchored to the knockback position for a seamless transition
            if (this.snapshotBuffer && this.snapshotBuffer.length > 0) {
                const latest = this.snapshotBuffer[this.snapshotBuffer.length - 1];
                latest.x = this.x;
                latest.y = this.y;
            }
            return;
        }

        const buffer = this.snapshotBuffer;
        if (!buffer || buffer.length === 0) return;

        const ping = (game && game.network && game.network.ping) ? game.network.ping : 35;
        const interpDelay = Math.max(30, Math.min(75, ping * 0.75));
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

            const targetX = s0.x + (s1.x - s0.x) * t;
            const targetY = s0.y + (s1.y - s0.y) * t;

            const dist = Math.hypot(targetX - this.x, targetY - this.y);
            if (dist > 160) {
                this.x = targetX;
                this.y = targetY;
            } else {
                const lerpRate = Math.min(1, 25 * dt);
                this.x += (targetX - this.x) * lerpRate;
                this.y += (targetY - this.y) * lerpRate;
            }

            let diff = (s1.r - s0.r) % (Math.PI * 2);
            if (diff < -Math.PI) diff += Math.PI * 2;
            if (diff > Math.PI) diff -= Math.PI * 2;
            this.r = s0.r + diff * t;
        } else if (s0) {
            const lerpRate = Math.min(1, 25 * dt);
            this.x += (s0.x - this.x) * lerpRate;
            this.y += (s0.y - this.y) * lerpRate;
            let diff = (s0.r - this.r) % (Math.PI * 2);
            if (diff < -Math.PI) diff += Math.PI * 2;
            if (diff > Math.PI) diff -= Math.PI * 2;
            this.r += diff * Math.min(1, 25 * dt);
        }
    }

    onServerDamaged(damage, newHp, pushAngle, pushForce, attackerId, game) {
        this.hp = newHp;
        this.hitFlash = 0.2;
        this.hitCooldown = 0.25;

        const isSelfAttacker = (game && game.selfId && attackerId === game.selfId);
        if (!isSelfAttacker) {
            if (game && game.spawnDamageCounter) {
                game.spawnDamageCounter(this.x, this.y - this.size - 18, damage, '#ef4444');
            }

            const angle = pushAngle !== undefined ? pushAngle : Math.random() * Math.PI * 2;
            const force = pushForce || 600;
            this.applyKnockback(angle, force);

            if (game && game.spawnBlood) {
                game.spawnBlood(this.x, this.y, this.bloodColor, newHp <= 0 ? 26 : 10, angle, newHp <= 0);
            }
        }

        if (this.hp <= 0) {
            this.isDead = true;
        }
    }

    // Static Factory to instantiate specific enemy types
    static create(type = 'Goblin', x = 0, y = 0, options = {}) {
        const t = (type || '').toLowerCase();
        switch (t) {
            case 'slime':
                return typeof Slime !== 'undefined' ? new Slime(x, y, options) : new Enemy(x, y, { name: 'Slime', hp: 40, color: '#10b981', bloodColor: '#059669', size: 17, speed: 130, damage: 8 }, options);
            case 'goblin':
                return typeof Goblin !== 'undefined' ? new Goblin(x, y, options) : new GoblinEnemy(x, y, options);
            case 'skeleton':
                return typeof Skeleton !== 'undefined' ? new Skeleton(x, y, options) : new SkeletonEnemy(x, y, options);
            case 'orc':
                return typeof Orc !== 'undefined' ? new Orc(x, y, options) : new OrcEnemy(x, y, options);
            default:
                return new Enemy(x, y, { name: 'Monster', hp: 50 }, options);
        }
    }

    takeDamage(amount, attacker, contactX, contactY, game) {
        if (this.hp <= 0 || this.isDead || this.hitCooldown > 0) return;

        this.hp = Math.max(0, this.hp - amount);
        this.hitCooldown = 0.25;
        this.hitFlash = 0.2;

        const pushAngle = attacker ? Math.atan2(this.y - attacker.y, this.x - attacker.x) : Math.random() * Math.PI * 2;

        // Spawn Damage Counter
        if (game && game.spawnDamageCounter) {
            game.spawnDamageCounter(this.x, this.y - this.size - 18, amount, '#ef4444');
        }

        if (this.hp <= 0) {
            this.isDead = true;
            if (game && game.spawnBlood) {
                game.spawnBlood(contactX || this.x, contactY || this.y, this.bloodColor, 26, pushAngle, true);
            }

            // Reward Player on Defeat
            if (attacker) {
                if (attacker.xp !== undefined) {
                    attacker.xp += this.xpReward;
                    const neededXp = attacker.maxXp || (attacker.level * 100);
                    if (attacker.xp >= neededXp) {
                        attacker.level = (attacker.level || 1) + 1;
                        attacker.xp -= neededXp;
                        attacker.maxXp = attacker.level * 100;
                        attacker.maxHp += 20;
                        attacker.hp = attacker.maxHp;
                    }
                }
                if (attacker.gold !== undefined) {
                    attacker.gold += this.goldReward;
                }
            }
        } else {
            // Apply Physical Knockback
            this.applyKnockback(pushAngle, 650);

            if (game && game.spawnBlood) {
                game.spawnBlood(contactX || this.x, contactY || this.y, this.bloodColor, 10, pushAngle, false);
            }

            if (this.onHitStun) {
                this.onHitStun();
            }
        }
    }

    getNearestPlayer(game) {
        let nearest = null;
        let minDist = Infinity;

        if (game && game.players) {
            for (const pid in game.players) {
                const p = game.players[pid];
                if (p.hp <= 0 || p.isDead) continue;
                const dist = Math.hypot(p.x - this.x, p.y - this.y);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = p;
                }
            }
        }
        return { player: nearest, dist: minDist };
    }

    resolveWallCollisions(game) {
        if (game && game.walls && Array.isArray(game.walls)) {
            for (const wall of game.walls) {
                wall.resolveCollision(this);
            }
        }
    }

    update(dt, game) {
        this.updateGeneral(dt);

        if (this.isDead || this.hp <= 0) return;

        if (this.attackCooldownTimer > 0) this.attackCooldownTimer -= dt;
        if (this.attackSwingTimer > 0) this.attackSwingTimer -= dt;

        if (game && !game.isOffline) {
            // Online multiplayer: smooth snapshot interpolation from server
            this.updateNetworkInterpolation(dt, game);
        } else {
            // Offline solo mode: local AI execution
            const { player, dist } = this.getNearestPlayer(game);
            this.updateAI(dt, game, player, dist);
        }

        this.resolveWallCollisions(game);
    }

    // Default AI Behavior: Chase player or roam near spawn anchor
    updateAI(dt, game, player, dist) {
        if (player && dist <= this.aggroRadius) {
            this.r = Math.atan2(this.y - player.y, this.x - player.x);
            const stopDist = this.size + (player.size || 20) - 2;

            if (dist > stopDist) {
                const angle = Math.atan2(player.y - this.y, player.x - this.x);
                const currentSpeed = this.isAttacking ? this.speed * 0.4 : this.speed;
                this.x += Math.cos(angle) * currentSpeed * dt;
                this.y += Math.sin(angle) * currentSpeed * dt;
            }

            if (dist <= this.size + (player.size || 20) + 12 && this.attackCooldownTimer <= 0) {
                this.attackCooldownTimer = this.attackInterval;
                this.isAttacking = true;
                this.attackSwingTimer = 0.35;
                if (player.takeDamage) {
                    player.takeDamage(this.damage, this, this.x, this.y, game);
                }
            }
        } else {
            this.isAttacking = false;
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                this.wanderAngle = Math.random() * Math.PI * 2;
                this.wanderTimer = Math.random() * 3 + 1.5;
            }
            const distFromSpawn = Math.hypot(this.x - this.spawnX, this.y - this.spawnY);
            if (distFromSpawn > 250) {
                this.wanderAngle = Math.atan2(this.spawnY - this.y, this.spawnX - this.x);
            }
            this.x += Math.cos(this.wanderAngle) * (this.speed * 0.45) * dt;
            this.y += Math.sin(this.wanderAngle) * (this.speed * 0.45) * dt;
            this.r = this.wanderAngle + Math.PI;
        }

        if (this.attackSwingTimer <= 0) {
            this.isAttacking = false;
        }
    }

    display(ctx, game) {
        if (this.isDead || this.hp <= 0) return;

        ctx.save();

        // 1. Health bar & Nameplate
        this.drawNameplate(ctx);

        // 2. Enemy Attack Visuals
        if (this.drawAttack) {
            this.drawAttack(ctx, game);
        }

        // 3. Enemy Body
        if (this.drawBody) {
            this.drawBody(ctx, game);
        } else {
            this.drawDefaultBody(ctx);
        }

        // 4. Debug Hitbox
        if (game && game.showHitboxes) {
            ctx.strokeStyle = '#ef4444';
            ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        ctx.restore();
    }

    drawNameplate(ctx) {
        const barWidth = 38;
        const barHeight = 5;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.size - 18;

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
        ctx.fillStyle = '#334155';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        const hpRatio = Math.max(0, Math.min(1, this.hp / this.maxHp));
        ctx.fillStyle = hpRatio > 0.5 ? '#10b981' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444';
        ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);

        ctx.font = 'bold 10px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.strokeText(this.name, this.x, barY - 4);
        ctx.fillText(this.name, this.x, barY - 4);
    }

    drawDefaultBody(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.hitFlash > 0 ? '#ef4444' : this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }
}

// Built-in Themed Enemy Subclasses
class GoblinEnemy extends Enemy {
    constructor(x, y, options = {}) {
        super(x, y, {
            name: "Goblin",
            hp: 60,
            maxHp: 60,
            speed: 150,
            size: 16,
            damage: 12,
            color: "#22c55e",
            bloodColor: "#15803d",
            xpReward: 35,
            goldReward: 12,
            aggroRadius: 280,
            attackInterval: 0.9
        }, options);
    }

    drawBody(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.r + Math.PI);

        ctx.fillStyle = this.hitFlash > 0 ? '#ef4444' : this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Goblin Pointy Ears
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.moveTo(-6, -this.size * 0.6);
        ctx.lineTo(-14, -this.size * 1.3);
        ctx.lineTo(2, -this.size * 0.7);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-6, this.size * 0.6);
        ctx.lineTo(-14, this.size * 1.3);
        ctx.lineTo(2, this.size * 0.7);
        ctx.fill();

        // Glowing Yellow Eyes
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(this.size * 0.45, -4, 2.5, 0, Math.PI * 2);
        ctx.arc(this.size * 0.45, 4, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

class SkeletonEnemy extends Enemy {
    constructor(x, y, options = {}) {
        super(x, y, {
            name: "Skeleton",
            hp: 85,
            maxHp: 85,
            speed: 110,
            size: 18,
            damage: 16,
            color: "#e2e8f0",
            bloodColor: "#94a3b8",
            xpReward: 50,
            goldReward: 20,
            aggroRadius: 300,
            attackInterval: 1.2
        }, options);
    }

    drawBody(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.r + Math.PI);

        ctx.fillStyle = this.hitFlash > 0 ? '#ef4444' : this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Skull Eye Sockets (Dark hollows)
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(this.size * 0.35, -5, 3, 0, Math.PI * 2);
        ctx.arc(this.size * 0.35, 5, 3, 0, Math.PI * 2);
        ctx.fill();

        // Glowing red pupil dots
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(this.size * 0.4, -5, 1.2, 0, Math.PI * 2);
        ctx.arc(this.size * 0.4, 5, 1.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

class OrcEnemy extends Enemy {
    constructor(x, y, options = {}) {
        super(x, y, {
            name: "Orc Berserker",
            hp: 170,
            maxHp: 170,
            speed: 85,
            size: 26,
            damage: 28,
            color: "#065f46",
            bloodColor: "#991b1b",
            xpReward: 120,
            goldReward: 60,
            aggroRadius: 320,
            attackInterval: 1.5
        }, options);
    }

    drawBody(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.r + Math.PI);

        ctx.fillStyle = this.hitFlash > 0 ? '#ef4444' : this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Orc Tusks
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(this.size * 0.5, -8);
        ctx.lineTo(this.size * 0.9, -11);
        ctx.lineTo(this.size * 0.6, -4);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(this.size * 0.5, 8);
        ctx.lineTo(this.size * 0.9, 11);
        ctx.lineTo(this.size * 0.6, 4);
        ctx.fill();

        // Fierce Red Eyes
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(this.size * 0.35, -6, 2.8, 0, Math.PI * 2);
        ctx.arc(this.size * 0.35, 6, 2.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
