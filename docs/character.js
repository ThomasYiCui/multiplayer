class Character {
    constructor(x, y, options = {}) {
        this.x = x;
        this.y = y;
        this.vX = options.vX || 0;
        this.vY = options.vY || 0;
        this.knockbackX = 0;
        this.knockbackY = 0;

        this.maxHp = options.maxHp || 100;
        this.hp = options.hp !== undefined ? options.hp : this.maxHp;
        this.regen = options.regen || 0;

        this.speed = options.speed || 200;
        this.size = options.size || 20;
        this.color = options.color || 'rgb(252, 219, 154)';

        this.hitCooldown = 0;
        this.hitFlash = 0;
        this.isDead = this.hp <= 0;
    }

    display(ctx) {
        ctx.save();
        if (this.hitFlash > 0) {
            ctx.fillStyle = '#ef4444';
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 12;
        } else {
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 0;
        }
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.size, this.size, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = this.hitFlash > 0 ? '#b91c1c' : '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    updatePosition(dt = 0.016) {
        // Move by velocity
        this.x += this.vX * dt;
        this.y += this.vY * dt;

        // Apply knockback velocity with exponential friction
        if (Math.abs(this.knockbackX) > 2 || Math.abs(this.knockbackY) > 2) {
            this.x += this.knockbackX * dt;
            this.y += this.knockbackY * dt;
            const friction = Math.pow(0.015, dt);
            this.knockbackX *= friction;
            this.knockbackY *= friction;
        } else {
            this.knockbackX = 0;
            this.knockbackY = 0;
        }
    }

    updateHealth(dt = 0.016) {
        // Apply health regeneration
        if (this.regen > 0 && this.hp > 0 && this.hp < this.maxHp) {
            this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);
        }

        if (this.hitCooldown > 0) this.hitCooldown -= dt;
        if (this.hitFlash > 0) this.hitFlash -= dt;

        if (this.hp <= 0) {
            this.isDead = true;
        }

        return this.isDead;
    }

    updateGeneral(dt = 0.016) {
        this.updatePosition(dt);
        this.updateHealth(dt);
        return this.isDead;
    }

    applyKnockback(angle, force = 650) {
        this.knockbackX = Math.cos(angle) * force;
        this.knockbackY = Math.sin(angle) * force;
    }

    takeDamage(amount, attacker, contactX, contactY, game) {
        if (this.hp <= 0 || this.isDead || this.hitCooldown > 0) return false;

        this.hp = Math.max(0, this.hp - amount);
        this.hitCooldown = 0.25;
        this.hitFlash = 0.2;

        const pushAngle = attacker ? Math.atan2(this.y - attacker.y, this.x - attacker.x) : Math.random() * Math.PI * 2;

        // Spawn floating damage counter
        if (game && game.spawnDamageCounter) {
            game.spawnDamageCounter(this.x, this.y - this.size - 15, amount, '#ef4444');
        }

        if (this.hp <= 0) {
            this.isDead = true;
            if (game && game.spawnBlood) {
                game.spawnBlood(contactX || this.x, contactY || this.y, '#dc2626', 25, pushAngle, true);
            }
        } else {
            this.applyKnockback(pushAngle, 650);
            if (game && game.spawnBlood) {
                game.spawnBlood(contactX || this.x, contactY || this.y, '#dc2626', 10, pushAngle, false);
            }
        }

        return true;
    }

    isCharacterDead() {
        return this.hp <= 0 || this.isDead;
    }
}