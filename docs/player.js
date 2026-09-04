class Player {
    constructor(x, y, id, playerName, opt = {}) {
        this.x = x;
        this.y = y;
        this.knockbackX = 0;
        this.knockbackY = 0;
        this.mouseX = 0;
        this.mouseY = 0;
        this.weapon = new Weapon(this, "Iron Sword");
        this.r = 0;
        this.targetX = x;
        this.targetY = y;
        this.id = id;
        this.isSelf = opt.isSelf || false;
        this.playerName = playerName || 'Adventurer';
        this.level = opt.level || 1;
        this.hp = opt.hp !== undefined ? opt.hp : 100;
        this.maxHp = opt.maxHp !== undefined ? opt.maxHp : 100;
        this.gold = opt.gold || 0;
        this.speed = 300; // Pixels per second
        this.size = 20;
        this.color = opt.color || `rgb(${Math.round(Math.random() * 255)}, ${Math.round(Math.random() * 255)}, ${Math.round(Math.random() * 255)})`;

        // Combat & Feedback
        this.hitCooldown = 0;
        this.hitFlash = 0;
        this.floatingTexts = [];
        this.particles = [];
    }

    // Spawn sparks/impact particles
    spawnHitParticles(contactX, contactY, pushAngle) {
        const originX = contactX !== undefined ? contactX : this.x;
        const originY = contactY !== undefined ? contactY : this.y;
        const baseAngle = pushAngle !== undefined ? pushAngle : Math.random() * Math.PI * 2;

        const particleCount = 8;
        for (let i = 0; i < particleCount; i++) {
            const spreadAngle = baseAngle + (Math.random() - 0.5) * 1.8;
            const speed = Math.random() * 160 + 60;
            this.particles.push({
                x: originX,
                y: originY,
                vx: Math.cos(spreadAngle) * speed,
                vy: Math.sin(spreadAngle) * speed,
                color: Math.random() > 0.3 ? '#fbbf24' : '#ef4444',
                size: Math.random() * 3 + 2,
                alpha: 1.0,
                life: 0.35,
                maxLife: 0.35
            });
        }
    }

    // Local / Offline Damage
    takeDamage(amount, attacker, contactX, contactY) {
        if (this.hitCooldown > 0) return;

        this.hp = Math.max(0, this.hp - amount);
        this.hitCooldown = 0.25; // 0.25s invulnerability
        this.hitFlash = 0.18;    // Flash bright red

        // Add floating damage number
        this.floatingTexts.push({
            text: `-${amount}`,
            x: this.x + (Math.random() * 16 - 8),
            y: this.y - this.size - 25,
            alpha: 1.0,
            scale: 1.3
        });

        // Apply physical knockback velocity
        let pushAngle = Math.random() * Math.PI * 2;
        if (attacker) {
            pushAngle = Math.atan2(this.y - attacker.y, this.x - attacker.x);
        }
        const force = 360;
        this.knockbackX = Math.cos(pushAngle) * force;
        this.knockbackY = Math.sin(pushAngle) * force;

        this.spawnHitParticles(contactX, contactY, pushAngle);

        // Dummy auto-respawn if defeated
        if (this.hp <= 0 && this.id === 'training-dummy') {
            setTimeout(() => {
                this.hp = this.maxHp;
                this.x = 250;
                this.y = 300;
                this.knockbackX = 0;
                this.knockbackY = 0;
            }, 1500);
        }
    }

    // Multiplayer Network Damage Handler
    onDamaged(damage, newHp, pushAngle, pushForce, newX, newY, attacker) {
        this.hp = newHp;
        this.hitFlash = 0.18;
        this.hitCooldown = 0.25;

        // Add floating damage number
        this.floatingTexts.push({
            text: `-${damage}`,
            x: this.x + (Math.random() * 16 - 8),
            y: this.y - this.size - 25,
            alpha: 1.0,
            scale: 1.3
        });

        // Apply smooth knockback impulse
        const angle = pushAngle !== undefined ? pushAngle : (attacker ? Math.atan2(this.y - attacker.y, this.x - attacker.x) : 0);
        const force = pushForce || 360;
        this.knockbackX = Math.cos(angle) * force;
        this.knockbackY = Math.sin(angle) * force;

        this.spawnHitParticles(this.x, this.y, angle);

        if (newX !== undefined && newY !== undefined) {
            if (this.isSelf) {
                // Lerp towards authoritative server position if out of sync
                this.x = (this.x + newX) / 2;
                this.y = (this.y + newY) / 2;
            } else {
                this.targetX = newX;
                this.targetY = newY;
            }
        }
    }

    display(ctx) {
        ctx.save();

        // 1. Render Hit Particles
        for (const p of this.particles) {
            ctx.save();
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, p.alpha);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 2. Health Bar & Level Tag above head
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

        // 3. Body Circle (Flashes bright red when taking damage)
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

        // 4. Render Equipped Weapon
        if (this.weapon) {
            this.weapon.display(ctx);
        }

        // 5. Floating Damage Numbers
        for (const ft of this.floatingTexts) {
            ctx.save();
            ctx.font = '900 16px "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = `rgba(239, 68, 68, ${ft.alpha})`;
            ctx.strokeStyle = `rgba(0, 0, 0, ${ft.alpha})`;
            ctx.lineWidth = 3;
            ctx.strokeText(ft.text, ft.x, ft.y);
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.restore();
        }

        ctx.restore();
    }

    update(input, game) {
        const dt = input.dt || 0.016;
        const moveDist = this.speed * dt;

        // Update hit timers
        if (this.hitCooldown > 0) this.hitCooldown -= dt;
        if (this.hitFlash > 0) this.hitFlash -= dt;

        // Update knockback velocity with exponential friction
        if (Math.abs(this.knockbackX) > 1 || Math.abs(this.knockbackY) > 1) {
            this.x += this.knockbackX * dt;
            this.y += this.knockbackY * dt;
            const friction = Math.pow(0.005, dt);
            this.knockbackX *= friction;
            this.knockbackY *= friction;
        } else {
            this.knockbackX = 0;
            this.knockbackY = 0;
        }

        // Update hit particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            p.alpha = Math.max(0, p.life / p.maxLife);
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Update floating damage texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.y -= 35 * dt;
            ft.alpha -= dt * 1.6;
            if (ft.alpha <= 0) {
                this.floatingTexts.splice(i, 1);
            }
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

            const mouseMoved = this.mouseX !== input.mouse.x || this.mouseY !== input.mouse.y;
            const mouseStateChanged = this.clicked !== input.clicked || this.dragged !== input.dragged;

            this.mouseX = input.mouse.x;
            this.mouseY = input.mouse.y;
            this.clicked = input.clicked;
            this.dragged = input.dragged;

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
                    if (target.hitCooldown > 0) continue;

                    const hitResult = this.weapon.checkHit(target);
                    if (hitResult && hitResult.hit) {
                        target.hitCooldown = 0.25;

                        // Trigger screen shake on local attacker for tactile hit satisfaction
                        if (game.triggerScreenShake) {
                            game.triggerScreenShake(4);
                        }

                        // Calculate physical knockback vector
                        const pushAngle = Math.atan2(target.y - this.y, target.x - this.x);
                        const pushForce = 380;

                        if (game.isOffline || target.id === 'training-dummy') {
                            target.takeDamage(hitResult.damage, this, hitResult.contactX, hitResult.contactY);
                        } else if (game.network) {
                            // Immediately spawn local sparks for responsiveness
                            target.spawnHitParticles(hitResult.contactX, hitResult.contactY, pushAngle);
                            game.network.sendHit(target.id, hitResult.damage, pushAngle, pushForce);
                        }
                    }
                }
            }

            if (game && !game.isOffline && game.network) {
                if (moved || Math.abs(this.knockbackX) > 2 || Math.abs(this.knockbackY) > 2) {
                    game.network.sendMove(this.x, this.y);
                }
                if (mouseMoved || mouseStateChanged) {
                    game.network.sendMouse(this.mouseX, this.mouseY, this.r, this.clicked, this.dragged);
                }
            }
        }

        if (!this.isSelf) {
            if (this.targetX !== undefined && this.targetY !== undefined) {
                const lerpRate = Math.min(1, 15 * dt);
                this.x += (this.targetX - this.x) * lerpRate;
                this.y += (this.targetY - this.y) * lerpRate;
            }
        }
    }
}