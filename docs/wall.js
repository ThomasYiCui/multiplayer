class Wall {
    constructor(x, y, w, h, options = {}) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.color = options.color || '#334155';
        this.borderColor = options.borderColor || '#475569';
        this.borderWidth = options.borderWidth || 2;
    }

    display(ctx) {
        ctx.save();

        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.w, this.h);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + this.h);
        ctx.lineTo(this.x, this.y);
        ctx.lineTo(this.x + this.w, this.y);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x + this.w, this.y);
        ctx.lineTo(this.x + this.w, this.y + this.h);
        ctx.lineTo(this.x, this.y + this.h);
        ctx.stroke();

        ctx.strokeStyle = this.borderColor;
        ctx.lineWidth = this.borderWidth;
        ctx.strokeRect(this.x, this.y, this.w, this.h);

        ctx.restore();
    }

    resolveCollision(entity) {
        if (!entity || entity.size === undefined) return;

        const radius = entity.size;

        const closestX = Math.max(this.x, Math.min(entity.x, this.x + this.w));
        const closestY = Math.max(this.y, Math.min(entity.y, this.y + this.h));

        const distX = entity.x - closestX;
        const distY = entity.y - closestY;
        const distanceSquared = (distX * distX) + (distY * distY);

        if (distanceSquared < (radius * radius)) {
            const distance = Math.sqrt(distanceSquared);

            if (distance === 0) {
                const left = entity.x - this.x;
                const right = (this.x + this.w) - entity.x;
                const top = entity.y - this.y;
                const bottom = (this.y + this.h) - entity.y;

                const min = Math.min(left, right, top, bottom);
                if (min === left) entity.x = this.x - radius;
                else if (min === right) entity.x = this.x + this.w + radius;
                else if (min === top) entity.y = this.y - radius;
                else entity.y = this.y + this.h + radius;
            } else {
                const overlap = radius - distance;
                const normalX = distX / distance;
                const normalY = distY / distance;

                entity.x += normalX * overlap;
                entity.y += normalY * overlap;
            }
        }
    }

    contains(px, py) {
        return px >= this.x && px <= this.x + this.w &&
            py >= this.y && py <= this.y + this.h;
    }
}