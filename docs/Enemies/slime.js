class Slime extends Enemy {
    constructor(x, y, options = {}) {
        super(x, y, {
            name: "Slime",
            hp: 40,
            maxHp: 40,
            speed: 130,
            size: 17,
            damage: 8,
            color: "#10b981",
            bloodColor: "#059669",
            xpReward: 25,
            goldReward: 6,
            aggroRadius: 260,
            attackInterval: 0.8
        }, options);

        // Slime Bouncing Animation State
        this.bounceTimer = Math.random() * 0.4;
        this.scaleX = 1.0;
        this.scaleY = 1.0;
        this.isAirborne = false;
        this.touchCooldown = 0;
    }

    updateAI(dt, game, targetPlayer, targetDist) {
        if (this.touchCooldown > 0) this.touchCooldown -= dt;

        const isChasing = targetPlayer && targetDist <= this.aggroRadius;
        const targetX = isChasing ? targetPlayer.x : (this.spawnX + Math.cos(this.wanderAngle) * 120);
        const targetY = isChasing ? targetPlayer.y : (this.spawnY + Math.sin(this.wanderAngle) * 120);

        this.r = Math.atan2(this.y - targetY, this.x - targetX);

        this.bounceTimer += dt;
        const cycleDuration = 0.95;
        const progress = (this.bounceTimer % cycleDuration);

        if (progress < 0.28) {
            // Phase 1: Squashing on ground before leaping
            this.isAirborne = false;
            const squashT = progress / 0.28;
            this.scaleX = 1.0 + Math.sin(squashT * Math.PI) * 0.35;
            this.scaleY = 1.0 - Math.sin(squashT * Math.PI) * 0.35;
        } else if (progress < 0.72) {
            // Phase 2: Airborne Leap!
            this.isAirborne = true;
            const leapT = (progress - 0.28) / 0.44;
            this.scaleX = 1.0 - Math.sin(leapT * Math.PI) * 0.25;
            this.scaleY = 1.0 + Math.sin(leapT * Math.PI) * 0.35;

            // Burst speed forward
            const moveAngle = Math.atan2(targetY - this.y, targetX - this.x);
            const currentMoveSpeed = this.speed * Math.sin(leapT * Math.PI) * 1.6;

            this.x += Math.cos(moveAngle) * currentMoveSpeed * dt;
            this.y += Math.sin(moveAngle) * currentMoveSpeed * dt;
        } else {
            // Phase 3: Landing recovery
            this.isAirborne = false;
            const landT = (progress - 0.72) / 0.23;
            this.scaleX = 1.0 + Math.sin(landT * Math.PI) * 0.2;
            this.scaleY = 1.0 - Math.sin(landT * Math.PI) * 0.2;
        }

        // Damage Player on Contact
        if (targetPlayer && this.touchCooldown <= 0) {
            const contactDist = this.size + (targetPlayer.size || 20);
            if (targetDist <= contactDist) {
                this.touchCooldown = this.attackInterval;
                if (targetPlayer.takeDamage) {
                    targetPlayer.takeDamage(this.damage, this, this.x, this.y, game);
                }
                // Bounce back on impact
                const bumpAngle = Math.atan2(this.y - targetPlayer.y, this.x - targetPlayer.x);
                this.knockbackX = Math.cos(bumpAngle) * 320;
                this.knockbackY = Math.sin(bumpAngle) * 320;
            }
        }

        if (!isChasing) {
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                this.wanderAngle = Math.random() * Math.PI * 2;
                this.wanderTimer = Math.random() * 3 + 2;
            }
        }
    }

    drawBody(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.scaleX, this.scaleY);

        if (this.hitFlash > 0) {
            ctx.fillStyle = '#ef4444';
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 12;
        } else {
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 0;
        }

        // Jelly Blob Shape
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Slime Core Glow
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.beginPath();
        ctx.arc(0, -this.size * 0.3, this.size * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        const eyeAngle = this.r + Math.PI;
        const eyeDist = this.size * 0.45;
        const leftEyeX = Math.cos(eyeAngle - 0.45) * eyeDist;
        const leftEyeY = Math.sin(eyeAngle - 0.45) * eyeDist;
        const rightEyeX = Math.cos(eyeAngle + 0.45) * eyeDist;
        const rightEyeY = Math.sin(eyeAngle + 0.45) * eyeDist;

        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(leftEyeX, leftEyeY, 3, 0, Math.PI * 2);
        ctx.arc(rightEyeX, rightEyeY, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#047857';
        ctx.beginPath();
        ctx.arc(leftEyeX, leftEyeY, 1.5, 0, Math.PI * 2);
        ctx.arc(rightEyeX, rightEyeY, 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
