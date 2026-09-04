class Player {
    constructor(x, y, id, playerName, opt = {}) {
        this.x = x;
        this.y = y;
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

        // Combat & Damage Feedback
        this.hitCooldown = 0;
        this.hitFlash = 0;
        this.floatingTexts = [];
    }

    takeDamage(amount, attacker) {
        if (this.hitCooldown > 0) return;

        this.hp = Math.max(0, this.hp - amount);
        this.hitCooldown = 0.25; // 0.25s invulnerability cooldown
        this.hitFlash = 0.15;    // Flash red for 0.15s

        // Add floating damage number
        this.floatingTexts.push({
            text: `-${amount}`,
            x: this.x + (Math.random() * 16 - 8),
            y: this.y - this.size - 25,
            alpha: 1.0
        });

        // Apply physical knockback push
        if (attacker) {
            const pushAngle = Math.atan2(this.y - attacker.y, this.x - attacker.x);
            this.x += Math.cos(pushAngle) * 18;
            this.y += Math.sin(pushAngle) * 18;
        }

        // Dummy auto-respawn if defeated
        if (this.hp <= 0 && this.id === 'training-dummy') {
            setTimeout(() => {
                this.hp = this.maxHp;
                this.x = 250;
                this.y = 300;
            }, 1500);
        }
    }

    display(ctx) {
        ctx.save();

        // 1. Health Bar & Level Tag above head
        const barWidth = 40;
        const barHeight = 5;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.size - 18;

        // Health bar background
        ctx.fillStyle = '#334155';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Health bar foreground
        const hpRatio = Math.max(0, Math.min(1, this.hp / this.maxHp));
        ctx.fillStyle = hpRatio > 0.5 ? '#10b981' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444';
        ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);

        // Health bar border
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);

        // Level & Name Label
        ctx.font = 'bold 11px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f8fafc';
        const tag = `[Lv.${this.level}] ${this.playerName}${this.isSelf ? ' (You)' : ''}`;
        ctx.fillText(tag, this.x, barY - 4);

        // 2. Body Circle (Flashes bright red when taking damage)
        ctx.fillStyle = this.hitFlash > 0 ? '#ef4444' : 'rgb(252, 219, 154)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.size, this.size, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#000000ff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 3. Render Equipped Weapon
        if (this.weapon) {
            this.weapon.display(ctx);
        }

        // 4. Floating Damage Numbers
        for (const ft of this.floatingTexts) {
            ctx.font = 'bold 14px "Segoe UI", sans-serif';
            ctx.fillStyle = `rgba(239, 68, 68, ${ft.alpha})`;
            ctx.strokeStyle = `rgba(0, 0, 0, ${ft.alpha})`;
            ctx.lineWidth = 2;
            ctx.strokeText(ft.text, ft.x, ft.y);
            ctx.fillText(ft.text, ft.x, ft.y);
        }

        ctx.restore();
    }

    update(input, game) {
        const dt = input.dt || 0.016;
        const moveDist = this.speed * dt;

        // Update hit timers
        if (this.hitCooldown > 0) this.hitCooldown -= dt;
        if (this.hitFlash > 0) this.hitFlash -= dt;

        // Update floating damage texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.y -= 25 * dt;
            ft.alpha -= dt * 1.5;
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
                    const hitResult = this.weapon.checkHit(target);
                    if (hitResult && hitResult.hit) {
                        target.takeDamage(hitResult.damage, this);
                    }
                }
            }

            if (game && !game.isOffline && game.network) {
                if (moved) {
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