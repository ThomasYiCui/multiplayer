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

}