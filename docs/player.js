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
        this.playerName = playerName;
        this.speed = 5;
        this.size = 20;
        this.color = opt.color || `rgb(${Math.round(Math.random() * 255)}, ${Math.round(Math.random() * 255)}, ${Math.round(Math.random() * 255)})`
    }

    display(ctx) {
        ctx.save()

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.size, this.size, 0, 0, 2 * Math.PI);
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(
            this.x - Math.cos(this.r) * this.size * 1.4,
            this.y - Math.sin(this.r) * this.size * 1.4,
            this.size * 0.35, this.size * 0.35,
            0, 0, 2 * Math.PI
        );
        ctx.fill();

        ctx.font = 'bold 12px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f8fafc';
        const label = this.isSelf ? `${this.playerName} (You)` : this.playerName;
        ctx.fillText(label, this.x, this.y + this.size + 15);

        ctx.restore()

    }


    update(input, game) {
        if (this.isSelf) {
            let moved = false;
            if (input.keys["KeyA"] || input.keys["ArrowLeft"]) {
                this.x -= this.speed;
                moved = true;
            }
            if (input.keys["KeyD"] || input.keys["ArrowRight"]) {
                this.x += this.speed;
                moved = true;
            }
            if (input.keys["KeyW"] || input.keys["ArrowUp"]) {
                this.y -= this.speed;
                moved = true;
            }
            if (input.keys["KeyS"] || input.keys["ArrowDown"]) {
                this.y += this.speed;
                moved = true;
            }

            const mouseMoved = this.mouseX !== input.mouse.x || this.mouseY !== input.mouse.y;
            const mouseStateChanged = this.clicked !== input.clicked || this.dragged !== input.dragged;

            this.mouseX = input.mouse.x;
            this.mouseY = input.mouse.y;
            this.clicked = input.clicked;
            this.dragged = input.dragged;

            this.r = Math.atan2(this.y - this.mouseY, this.x - this.mouseX);

            if (game && !game.isOffline && game.network) {
                if (moved) {
                    game.network.sendMove(this.x, this.y);
                }
                if (mouseMoved || mouseStateChanged) {
                    game.network.sendMouse(this.mouseX, this.mouseY, this.clicked, this.dragged);
                }
            }
        }
        if (!this.isSelf) {
            this.r = Math.atan2(this.y - this.mouseY, this.x - this.mouseX);
            if (this.targetX !== undefined && this.targetY !== undefined) {
                this.x += (this.targetX - this.x) * 0.25;
                this.y += (this.targetY - this.y) * 0.25;
            }
        }
    }

}