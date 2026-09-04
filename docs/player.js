class Player {
    constructor(x, y, id, playerName, opt = {}) {
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.id = id;
        this.isSelf = opt.isSelf || false;
        this.playerName = playerName;
        this.speed = 5;
        this.size = 34;
        this.color = opt.color || `rgb(${Math.round(Math.random() * 255)}, ${Math.round(Math.random() * 255)}, ${Math.round(Math.random() * 255)})`
    }

    display(ctx) {
        ctx.save()

        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);

        ctx.font = 'bold 16px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f8fafc';
        const label = this.isSelf ? `${this.playerName} (You)` : this.playerName;
        ctx.fillText(label, this.x + this.size / 2, this.y - this.size / 2);

        ctx.restore()

    }


    update(keys, game) {
        if (this.isSelf) {
            let moved = false;
            if (keys["KeyA"] || keys["ArrowLeft"]) {
                this.x -= this.speed;
                moved = true;
            }
            if (keys["KeyD"] || keys["ArrowRight"]) {
                this.x += this.speed;
                moved = true;
            }
            if (keys["KeyW"] || keys["ArrowUp"]) {
                this.y -= this.speed;
                moved = true;
            }
            if (keys["KeyS"] || keys["ArrowDown"]) {
                this.y += this.speed;
                moved = true;
            }

            if (moved && game && !game.isOffline && game.network) {
                game.network.sendMove(this.x, this.y);
            }
        }
        if (!this.isSelf) {
            if (this.targetX !== undefined && this.targetY !== undefined) {
                this.x += (this.targetX - this.x) * 0.25;
                this.y += (this.targetY - this.y) * 0.25;
            }
        }
    }

}