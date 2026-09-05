class Particle {
    constructor(x, y, life = 0.4, options = {}) {
        this.x = x;
        this.y = y;
        this.life = life;
        this.maxLife = life;

        this.anchorObject = options.anchorObject || null;
        this.vX = options.vX !== undefined ? options.vX : (options.vx || 0);
        this.vY = options.vY !== undefined ? options.vY : (options.vy || 0);
        this.gravity = options.gravity || 0;
        this.drag = options.drag !== undefined ? options.drag : 0.97;

        this.color = options.color || [255, 0, 0];
        this.size = options.size || 5;
        this.transparencyStart = options.transparencyStart !== undefined ? options.transparencyStart : 1.0;
        this.transparency = this.transparencyStart;
        this.transparencyEnd = options.transparencyEnd !== undefined ? options.transparencyEnd : 0.0;
    }

    display(ctx) {
        if (this.transparency <= 0) return;
        ctx.save();
        const alpha = Math.max(0, Math.min(1, this.transparency));
        if (Array.isArray(this.color)) {
            ctx.fillStyle = `rgba(${this.color[0]}, ${this.color[1]}, ${this.color[2]}, ${alpha})`;
        } else if (typeof this.color === 'string') {
            ctx.globalAlpha = alpha;
            ctx.fillStyle = this.color;
        } else {
            ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
        }
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(0.5, this.size), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    update(dt = 0.016) {
        this.life -= dt;
        const progress = this.maxLife > 0 ? Math.max(0, Math.min(1, this.life / this.maxLife)) : 0;
        this.transparency = this.transparencyEnd + (this.transparencyStart - this.transparencyEnd) * progress;

        this.vY += this.gravity * (dt * 60);
        this.x += this.vX * (dt * 60);
        this.y += this.vY * (dt * 60);

        const dragFactor = Math.pow(this.drag, dt * 60);
        this.vX *= dragFactor;
        this.vY *= dragFactor;
    }

    isDead() {
        return this.life <= 0 || this.transparency <= 0;
    }
}