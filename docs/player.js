class Player {
    constructor(x, y, id, playerName, opt = {}) {
        this.x = x;
        this.y = y;
        this.mouseX = 0;
        this.mouseY = 0;
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

        // 2. Body Circle
        ctx.fillStyle = 'rgb(252, 219, 154)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.size, this.size, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 3. Sword & Hands (Rotated towards pointing angle)
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.r + Math.PI);

        // --- SWORD BLADE ---
        ctx.beginPath();
        ctx.moveTo(54, -6);
        ctx.lineTo(112, -6);
        ctx.lineTo(129, 0);   // Sharp pointy tip
        ctx.lineTo(112, 6);
        ctx.lineTo(54, 6);
        ctx.closePath();

        // Steel blade fill
        ctx.fillStyle = '#e2e8f0';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Blade center ridge highlight
        ctx.beginPath();
        ctx.moveTo(56, 0);
        ctx.lineTo(122, 0);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // --- CROSSGUARD ---
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(50, -14, 6, 28, 2) : ctx.rect(50, -14, 6, 28);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // --- HILT / GRIP ---
        ctx.fillStyle = '#78350f';
        ctx.fillRect(30, -3.5, 20, 7);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(30, -3.5, 20, 7);

        // --- POMMEL ---
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.ellipse(28, 0, 4.5, 4.5, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // --- HANDS (Holding Grip) ---
        ctx.fillStyle = 'rgb(252, 219, 154)';
        ctx.beginPath();
        ctx.ellipse(40, 0, this.size * 0.35, this.size * 0.35, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();

        ctx.restore();
    }

    update(input, game) {
        const dt = input.dt || 0.016;
        const moveDist = this.speed * dt;

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

            if (game && game.walls && Array.isArray(game.walls)) {
                for (const wall of game.walls) {
                    wall.resolveCollision(this);
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