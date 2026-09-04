class Weapon {
    constructor(player, type = "Iron Sword", options = {}) {
        this.player = player;
        this.type = type;
        this.options = options;
    }

    iron_sword(ctx) {
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
        ctx.ellipse(40, 0, this.player.size * 0.35, this.player.size * 0.35, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    display(ctx) {
        // 2-line transform: move to player position and rotate towards pointing angle
        ctx.save();
        ctx.translate(this.player.x, this.player.y);
        ctx.rotate(this.player.r + Math.PI);

        switch (this.type) {
            case "Iron Sword":
                this.iron_sword(ctx)
                break;
        }

        ctx.restore();
    }
}