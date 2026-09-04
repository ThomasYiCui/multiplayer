class Weapon {
    constructor(player, type = "Iron Sword", options = {}) {
        this.player = player;
        this.type = type;
        this.options = options;

        // Weapon physical properties & reach
        this.configs = {
            "Iron Sword": { hilt: 30, reach: 129, width: 8, damage: 15 },
            "Battle Axe": { hilt: 30, reach: 118, width: 22, damage: 24 },
            "War Hammer": { hilt: 30, reach: 112, width: 24, damage: 30 },
            "Dagger":     { hilt: 26, reach: 82,  width: 6, damage: 10 },
            "Spear":      { hilt: 30, reach: 172, width: 8, damage: 20 }
        };
    }

    getConfig() {
        return this.configs[this.type] || this.configs["Iron Sword"];
    }

    setType(newType) {
        if (this.configs[newType]) {
            this.type = newType;
        }
    }

    // Get the exact world coordinates of the blade line segment (Hilt to Tip)
    getBladeSegment() {
        if (!this.player) return null;
        const config = this.getConfig();
        const angle = this.player.r + Math.PI;

        return {
            x1: this.player.x + Math.cos(angle) * config.hilt,
            y1: this.player.y + Math.sin(angle) * config.hilt,
            x2: this.player.x + Math.cos(angle) * config.reach,
            y2: this.player.y + Math.sin(angle) * config.reach,
            width: config.width
        };
    }

    // ALWAYS ACTIVE: Physical line-segment vs target circle collision check
    checkHit(target) {
        if (!target || !this.player || target === this.player) return false;

        const seg = this.getBladeSegment();
        if (!seg) return false;

        const dx = seg.x2 - seg.x1;
        const dy = seg.y2 - seg.y1;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return false;

        // Project target center onto blade line segment (clamped 0 to 1)
        let t = ((target.x - seg.x1) * dx + (target.y - seg.y1) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));

        // Closest point on the weapon blade to the target
        const closestX = seg.x1 + t * dx;
        const closestY = seg.y1 + t * dy;

        // Distance from closest point on blade to target center
        const distX = target.x - closestX;
        const distY = target.y - closestY;
        const distance = Math.sqrt(distX * distX + distY * distY);

        // Physical collision check
        const targetRadius = target.size || 20;
        const hitThreshold = targetRadius + seg.width;

        if (distance <= hitThreshold) {
            return {
                hit: true,
                contactX: closestX,
                contactY: closestY,
                damage: this.getConfig().damage
            };
        }

        return false;
    }

    // 1. IRON SWORD
    iron_sword(ctx) {
        // --- SWORD BLADE ---
        ctx.beginPath();
        ctx.moveTo(54, -6);
        ctx.lineTo(112, -6);
        ctx.lineTo(129, 0);   // Sharp pointy tip
        ctx.lineTo(112, 6);
        ctx.lineTo(54, 6);
        ctx.closePath();
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

    // 2. BATTLE AXE
    battle_axe(ctx) {
        // Wood Haft
        ctx.fillStyle = '#78350f';
        ctx.fillRect(26, -3.5, 88, 7);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(26, -3.5, 88, 7);

        // Gold Ring Bands
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(82, -4.5, 4, 9);
        ctx.strokeRect(82, -4.5, 4, 9);
        ctx.fillRect(106, -4.5, 4, 9);
        ctx.strokeRect(106, -4.5, 4, 9);

        // Double Crescent Axe Blades
        ctx.beginPath();
        ctx.moveTo(86, -3);
        ctx.quadraticCurveTo(80, -22, 108, -26);
        ctx.quadraticCurveTo(116, -14, 104, -3);
        ctx.closePath();
        ctx.fillStyle = '#cbd5e1';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(86, 3);
        ctx.quadraticCurveTo(80, 22, 108, 26);
        ctx.quadraticCurveTo(116, 14, 104, 3);
        ctx.closePath();
        ctx.fillStyle = '#cbd5e1';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Top Spike
        ctx.beginPath();
        ctx.moveTo(114, -3);
        ctx.lineTo(122, 0);
        ctx.lineTo(114, 3);
        ctx.closePath();
        ctx.fillStyle = '#94a3b8';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Hands (Two-handed grip)
        ctx.fillStyle = 'rgb(252, 219, 154)';
        ctx.beginPath();
        ctx.ellipse(36, 0, this.player.size * 0.35, this.player.size * 0.35, 0, 0, 2 * Math.PI);
        ctx.ellipse(56, 0, this.player.size * 0.35, this.player.size * 0.35, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // 3. WAR HAMMER
    war_hammer(ctx) {
        // Heavy Handle
        ctx.fillStyle = '#475569';
        ctx.fillRect(26, -4, 82, 8);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(26, -4, 82, 8);

        // Hammer Head (Heavy Steel Block)
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(90, -16, 18, 32, 3) : ctx.rect(90, -16, 18, 32);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Gold Reinforcement Ring
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(86, -7, 5, 14);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(86, -7, 5, 14);

        // Back Spike
        ctx.beginPath();
        ctx.moveTo(90, -4);
        ctx.lineTo(76, 0);
        ctx.lineTo(90, 4);
        ctx.closePath();
        ctx.fillStyle = '#94a3b8';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Front Striking Plate
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(108, -12, 4, 24);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(108, -12, 4, 24);

        // Hands
        ctx.fillStyle = 'rgb(252, 219, 154)';
        ctx.beginPath();
        ctx.ellipse(36, 0, this.player.size * 0.35, this.player.size * 0.35, 0, 0, 2 * Math.PI);
        ctx.ellipse(54, 0, this.player.size * 0.35, this.player.size * 0.35, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // 4. DAGGER
    dagger(ctx) {
        // Blade (Short & Sharp)
        ctx.beginPath();
        ctx.moveTo(48, -4.5);
        ctx.lineTo(72, -4.5);
        ctx.lineTo(84, 0);
        ctx.lineTo(72, 4.5);
        ctx.lineTo(48, 4.5);
        ctx.closePath();
        ctx.fillStyle = '#f1f5f9';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Curved Brass Guard
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(44, -10, 4, 20, 2) : ctx.rect(44, -10, 4, 20);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Grip
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(28, -2.5, 16, 5);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(28, -2.5, 16, 5);

        // Hand
        ctx.fillStyle = 'rgb(252, 219, 154)';
        ctx.beginPath();
        ctx.ellipse(36, 0, this.player.size * 0.32, this.player.size * 0.32, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // 5. SPEAR
    spear(ctx) {
        // Long Shaft
        ctx.fillStyle = '#92400e';
        ctx.fillRect(26, -3, 130, 6);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(26, -3, 130, 6);

        // Crimson Ribbon / Tassel
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(148, -3);
        ctx.lineTo(138, -12);
        ctx.lineTo(142, 0);
        ctx.lineTo(138, 12);
        ctx.lineTo(148, 3);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Leaf-shaped Spearhead
        ctx.beginPath();
        ctx.moveTo(150, -6);
        ctx.lineTo(172, 0);
        ctx.lineTo(150, 6);
        ctx.closePath();
        ctx.fillStyle = '#e2e8f0';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Spear center ridge
        ctx.beginPath();
        ctx.moveTo(150, 0);
        ctx.lineTo(170, 0);
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Hands (Wide spear stance)
        ctx.fillStyle = 'rgb(252, 219, 154)';
        ctx.beginPath();
        ctx.ellipse(38, 0, this.player.size * 0.35, this.player.size * 0.35, 0, 0, 2 * Math.PI);
        ctx.ellipse(78, 0, this.player.size * 0.35, this.player.size * 0.35, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    display(ctx) {
        if (!this.player) return;

        // 2-line transform: move to player position and rotate towards pointing angle
        ctx.save();
        ctx.translate(this.player.x, this.player.y);
        ctx.rotate(this.player.r + Math.PI);

        switch (this.type) {
            case "Iron Sword":
                this.iron_sword(ctx);
                break;
            case "Battle Axe":
                this.battle_axe(ctx);
                break;
            case "War Hammer":
                this.war_hammer(ctx);
                break;
            case "Dagger":
                this.dagger(ctx);
                break;
            case "Spear":
                this.spear(ctx);
                break;
            default:
                this.iron_sword(ctx);
        }

        ctx.restore();
    }
}