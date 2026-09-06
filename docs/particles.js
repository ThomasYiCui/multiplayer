class Particle {
    constructor(x, y, life, options) {
        this.x = x;
        this.y = y;
        this.life = life;

        this.anchorObject = options.anchorObject || null;
        this.vX = options.vX || 0;
        this.vY = options.vY || 0;
        this.drag = options.drag || 0.97;

        this.color = options.color || [255, 0, 0];
        this.size = options.size || 10;
        this.transparencyStart = options.transparencyStart || 0.5;
        this.transparency = this.transparencyStart;
        this.transparencyEnd = options.transparencyEnd || 0.1;
    }

    display(ctx) {
        ctx.fillStyle = `rgb(${this.color[0]}, ${this.color[1]}, ${this.color[2]}, ${this.transparency})`
        ctx.beginPath();
        ctx.ellipse(this.x + this.anchorObject.x, this.y + this.anchorObject.y, this.size, this.size, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    update() {
        this.life -= 1;

        this.transparency = this.transparencyStart + (this.transparencyEnd - this.transparencyStart) * (this.life / this.maxLife);

        this.x += this.vX;
        this.y += this.vY;

        this.vX *= this.drag;
        this.vY *= this.drag;
    }
}