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
        this.prevR = 0;
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
        this.isDead = this.hp <= 0;

        // Combat & Feedback
        this.hitCooldown = 0;
        this.hitFlash = 0;
        this.floatingTexts = [];
        this.particles = [];
    }

    // Spawn realistic blood splatter particles
    spawnBloodParticles(contactX, contactY, pushAngle, isDeath = false) {
        const originX = contactX !== undefined ? contactX : this.x;
        const originY = contactY !== undefined ? contactY : this.y;
        const baseAngle = pushAngle !== undefined ? pushAngle : Math.random() * Math.PI * 2;

        const bloodColors = ['#dc2626', '#b91c1c', '#991b1b', '#7f1d1d', '#ef4444'];
        const particleCount = isDeath ? 28 : 10;

        for (let i = 0; i < particleCount; i++) {
            const spreadAngle = isDeath
                ? Math.random() * Math.PI * 2
                : baseAngle + (Math.random() - 0.5) * 1.6;
            const speed = isDeath
                ? Math.random() * 240 + 60
                : Math.random() * 180 + 70;
            const size = isDeath
                ? Math.random() * 4 + 2.5
                : Math.random() * 3 + 1.5;
            const life = isDeath
                ? Math.random() * 0.3 + 0.35
                : Math.random() * 0.2 + 0.25;

            this.particles.push({
                x: originX,
                y: originY,
                vx: Math.cos(spreadAngle) * speed,
                vy: Math.sin(spreadAngle) * speed,
                color: bloodColors[Math.floor(Math.random() * bloodColors.length)],
                size: size,
                alpha: 1.0,
                life: life,
                maxLife: life
            });
        }
    }

    // Local / Offline Damage
    takeDamage(amount, attacker, contactX, contactY) {
        if (this.hp <= 0 || this.isDead || this.hitCooldown > 0) return;

        this.hp = Math.max(0, this.hp - amount);
        this.hitCooldown = 0.25; // 0.25s invulnerability
        this.hitFlash = 0.2;     // Flash bright red

        const pushAngle = attacker ? Math.atan2(this.y - attacker.y, this.x - attacker.x) : Math.random() * Math.PI * 2;

        // Add floating damage number
        this.floatingTexts.push({
            text: `-${amount}`,
            x: this.x + (Math.random() * 16 - 8),
            y: this.y - this.size - 25,
            alpha: 1.0,
            scale: 1.3
        });

        if (this.hp <= 0) {
            this.isDead = true;
            this.spawnBloodParticles(contactX || this.x, contactY || this.y, pushAngle, true);

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
            const force = 650;
            this.knockbackX = Math.cos(pushAngle) * force;
            this.knockbackY = Math.sin(pushAngle) * force;
            this.targetX = this.x + Math.cos(pushAngle) * 80;
            this.targetY = this.y + Math.sin(pushAngle) * 80;

            this.spawnBloodParticles(contactX, contactY, pushAngle, false);
        }
    }

    // Multiplayer Network Damage Handler
    onDamaged(damage, newHp, pushAngle, pushForce, newX, newY, attacker) {
        this.hp = newHp;
        this.hitFlash = 0.2;
        this.hitCooldown = 0.25;

        // Add floating damage number
        this.floatingTexts.push({
            text: `-${damage}`,
            x: this.x + (Math.random() * 16 - 8),
            y: this.y - this.size - 25,
            alpha: 1.0,
            scale: 1.3
        });

        const angle = pushAngle !== undefined ? pushAngle : (attacker ? Math.atan2(this.y - attacker.y, this.x - attacker.x) : 0);

        if (this.hp <= 0) {
            this.isDead = true;
            this.spawnBloodParticles(this.x, this.y, angle, true);
        } else {
            // Apply smooth knockback impulse
            const force = pushForce || 650;
            this.knockbackX = Math.cos(angle) * force;
            this.knockbackY = Math.sin(angle) * force;

            this.spawnBloodParticles(this.x, this.y, angle, false);

            if (this.isSelf) {
                this.lastSyncTime = 0; // Force immediate broadcast of knocked position
            }
        }
    }

    display(ctx, game) {
        ctx.save();

        // 1. Render Blood Particles (always rendered so death splatter animates)
        for (const p of this.particles) {
            ctx.save();
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, p.alpha);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 2. Floating Damage Numbers
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

        // DESPAWN: If player is at 0 HP or dead, hide body, weapon, and health bar completely!
        if (this.hp <= 0 || this.isDead) {
            ctx.restore();
            return;
        }

        // 3. Health Bar & Level Tag above head
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

        // 4. Body Circle (Flashes bright red when taking damage)
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

        // 5. Render Equipped Weapon
        if (this.weapon) {
            this.weapon.display(ctx);
        }

        // 6. DEBUG HITBOXES: Visible collision circle and blade hitbox
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

        // Update hit timers
        if (this.hitCooldown > 0) this.hitCooldown -= dt;
        if (this.hitFlash > 0) this.hitFlash -= dt;

        // Update knockback velocity with smooth exponential friction
        if (Math.abs(this.knockbackX) > 2 || Math.abs(this.knockbackY) > 2) {
            this.x += this.knockbackX * dt;
            this.y += this.knockbackY * dt;
            const friction = Math.pow(0.015, dt);
            this.knockbackX *= friction;
            this.knockbackY *= friction;
        } else {
            this.knockbackX = 0;
            this.knockbackY = 0;
        }

        // Update blood particles (with deceleration and gravity)
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 80 * dt; // Gravity
            p.vx *= Math.pow(0.15, dt); // Air drag
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

            const mouseMoved = this.mouseX !== input.mouse.x || this.mouseY !== input.mouse.y;
            const mouseStateChanged = this.clicked !== input.clicked || this.dragged !== input.dragged;

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
                        target.hitCooldown = 0.25;

                        // Trigger screen shake on local attacker for tactile hit satisfaction
                        if (game.triggerScreenShake) {
                            game.triggerScreenShake(5);
                        }

                        // Calculate physical knockback vector
                        const pushAngle = Math.atan2(target.y - this.y, target.x - this.x);
                        const pushForce = 650;

                        if (game.isOffline || target.id === 'training-dummy') {
                            // Offline / Solo Mode: Apply local damage and knockback
                            target.takeDamage(hitResult.damage, this, hitResult.contactX, hitResult.contactY);
                        } else if (game.network) {
                            // Online Multiplayer: Apply immediate knockback & blood feedback on target
                            target.knockbackX = Math.cos(pushAngle) * pushForce;
                            target.knockbackY = Math.sin(pushAngle) * pushForce;
                            target.targetX = target.x + Math.cos(pushAngle) * 80;
                            target.targetY = target.y + Math.sin(pushAngle) * 80;

                            target.spawnBloodParticles(hitResult.contactX, hitResult.contactY, pushAngle, false);
                            target.floatingTexts.push({
                                text: `-${hitResult.damage}`,
                                x: target.x + (Math.random() * 16 - 8),
                                y: target.y - target.size - 25,
                                alpha: 1.0,
                                scale: 1.3
                            });
                            target.hitFlash = 0.2;
                            game.network.sendHit(target.id, hitResult.damage, pushAngle, pushForce);
                        }
                    }
                }
            }

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

                // Sync at 30Hz or immediately on significant movement
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
            if (this.targetX !== undefined && this.targetY !== undefined) {
                // If remote player is being knocked back, let knockback slide without lerp canceling it
                if (Math.abs(this.knockbackX) > 2 || Math.abs(this.knockbackY) > 2) {
                    this.targetX = this.x;
                    this.targetY = this.y;
                } else {
                    const lerpRate = Math.min(1, 20 * dt);
                    this.x += (this.targetX - this.x) * lerpRate;
                    this.y += (this.targetY - this.y) * lerpRate;
                }
            }
            if (this.targetR !== undefined) {
                // Shortest angular distance interpolation for smooth sword rotation
                let diff = (this.targetR - this.r) % (Math.PI * 2);
                if (diff < -Math.PI) diff += Math.PI * 2;
                if (diff > Math.PI) diff -= Math.PI * 2;
                this.r += diff * Math.min(1, 25 * dt);
            }
        }
    }
}