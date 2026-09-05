class DamageCounter {
    constructor(x, y, amount, options = {}) {
        this.x = x + (Math.random() * 16 - 8);
        this.y = y;
        this.text = options.text || (typeof amount === 'number' ? (amount > 0 ? `-${amount}` : `${amount}`) : String(amount));
        this.color = options.color || '#ef4444';
        this.strokeColor = options.strokeColor || '#0f172a';
        this.vY = options.vY || -40;
        this.vX = options.vX || (Math.random() * 24 - 12);
        this.life = options.life || 0.65;
        this.maxLife = this.life;
        this.alpha = 1.0;
        this.scale = options.scale || 1.2;
        this.fontSize = options.fontSize || 16;
    }

    update(dt = 0.016) {
        this.life -= dt;
        this.alpha = Math.max(0, this.life / this.maxLife);
        this.x += this.vX * dt;
        this.y += this.vY * dt;
        this.vY += 25 * dt; // Gentle deceleration
    }

    display(ctx) {
        if (this.alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, this.alpha));
        ctx.font = `900 ${Math.round(this.fontSize * this.scale)}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = 3.5;
        ctx.strokeText(this.text, this.x, this.y);
        ctx.fillStyle = this.color;
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }

    isDead() {
        return this.life <= 0 || this.alpha <= 0;
    }
}
