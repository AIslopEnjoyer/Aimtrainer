// Spielmodi + Statistik. Jeder Modus kapselt Ziel-Spawning und Scoring.

export class Stats {
  constructor() {
    this.shots = 0;
    this.hits = 0;
    this.headshots = 0;
    this.kills = 0;
    this.deaths = 0;
    this.score = 0;
    this.damage = 0;
    this._reactionSum = 0;
    this._reactionCount = 0;
    this.bestReaction = Infinity;
  }
  addReaction(ms) {
    this._reactionSum += ms;
    this._reactionCount++;
    if (ms < this.bestReaction) this.bestReaction = ms;
  }
  accuracy() {
    return this.shots === 0 ? 100 : (this.hits / this.shots) * 100;
  }
  avgReaction() {
    return this._reactionCount === 0 ? null : this._reactionSum / this._reactionCount;
  }
}

// Basisklasse
class Mode {
  constructor(ctx) {
    this.ctx = ctx;         // { targets, bot, stats, player }
    this.showHealth = false;
    this.showReaction = false;
    this.showKills = false;
  }
  start() {}
  update(dt) {}
  raycast(camera, ndc) { return this.ctx.targets.raycast(camera, ndc); }
  // Liefert { kill, points, isHead }
  applyHit(hit, damage) { return { kill: false, points: 0, isHead: false }; }
  stop() { this.ctx.targets.clear(); }
}

// -------- Flick / Clicking: 1 statisches Ziel, One-Shot, Reaktionszeit --------
export class FlickMode extends Mode {
  constructor(ctx) {
    super(ctx);
    this.showReaction = true;
  }
  start() {
    this.ctx.targets.clear();
    this.ctx.targets.spawnRandom(1);
  }
  applyHit(hit) {
    const t = hit.target;
    const reaction = performance.now() - t.spawnTime;
    this.ctx.stats.addReaction(reaction);
    this.ctx.targets.remove(t);
    this.ctx.targets.spawnRandom(1);
    // Score: Grundwert + Reaktionsbonus + Headshot
    const reactBonus = Math.max(0, 300 - reaction) * 0.3;
    const head = hit.isHead ? 40 : 0;
    if (hit.isHead) this.ctx.stats.headshots++;
    return { kill: true, points: Math.round(100 + reactBonus + head), isHead: hit.isHead };
  }
}

// -------- Target Switching: mehrere Ziele gleichzeitig --------
export class SwitchingMode extends Mode {
  constructor(ctx) {
    super(ctx);
    this.count = 5;
  }
  start() {
    this.ctx.targets.clear();
    for (let i = 0; i < this.count; i++) this.ctx.targets.spawnSpread(i, this.count, 1);
  }
  applyHit(hit) {
    const t = hit.target;
    this.ctx.targets.remove(t);
    // sofort ein neues Ziel nachlegen, damit immer count Ziele existieren
    this.ctx.targets.spawnRandom(1);
    const head = hit.isHead ? 50 : 0;
    if (hit.isHead) this.ctx.stats.headshots++;
    return { kill: true, points: 120 + head, isHead: hit.isHead };
  }
}

// -------- Tracking: 1 strafendes Ziel mit HP, kontinuierlicher Schaden --------
export class TrackingMode extends Mode {
  constructor(ctx) {
    super(ctx);
    this.hp = 160;
  }
  start() {
    this.ctx.targets.clear();
    this.ctx.targets.spawnRandom(this.hp, { moving: true });
  }
  update(dt) {
    this.ctx.targets.update(dt);
  }
  applyHit(hit, damage) {
    const t = hit.target;
    const head = hit.isHead ? damage * 0.6 : 0;
    if (hit.isHead) this.ctx.stats.headshots++;
    const total = damage + head;
    this.ctx.stats.damage += total;
    const kill = t.damage(total);
    let points = Math.round(total * 1.2);
    if (kill) {
      points += 150;
      this.ctx.targets.remove(t);
      this.ctx.targets.spawnRandom(this.hp, { moving: true });
    }
    return { kill, points, isHead: hit.isHead };
  }
}

// -------- Strafe-Duell: Bot strafed, springt und schießt zurück --------
export class DuelMode extends Mode {
  constructor(ctx) {
    super(ctx);
    this.showHealth = true;
    this.showKills = true;
    this.respawnTimer = 0;
  }
  start() {
    this.ctx.targets.clear();
    this.ctx.bot.reset();
    this.ctx.player.hp = this.ctx.player.maxHp;
    this.respawnTimer = 0;
  }
  raycast(camera, ndc) {
    return this.ctx.bot.raycast(camera, ndc);
  }
  applyHit(hit, damage) {
    const res = this.ctx.bot.damage(damage, hit.isHead);
    if (hit.isHead) this.ctx.stats.headshots++;
    let points = Math.round(damage * (hit.isHead ? 1.8 : 1) * 1.0);
    if (res.killed) {
      this.ctx.stats.kills++;
      points += 250;
      this.respawnTimer = 1.0;
    }
    return { kill: res.killed, points, isHead: hit.isHead };
  }
  update(dt) {
    const bot = this.ctx.bot;
    if (!bot.alive) {
      if (this.respawnTimer > 0) {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) bot.reset();
      }
      return;
    }
    bot.update(dt, this.ctx.player.speed2D(), (dmg) => {
      if (dmg > 0) {
        const dead = this.ctx.player.damage(dmg);
        this.ctx.onPlayerHit(dmg, dead);
        if (dead) {
          this.ctx.stats.deaths++;
          this.ctx.player.hp = this.ctx.player.maxHp;
          bot.reset();
        }
      }
    });
  }
  stop() {
    this.ctx.bot.hide();
  }
}

export const MODE_REGISTRY = {
  flick: { cls: FlickMode, title: 'Flick / Clicking' },
  tracking: { cls: TrackingMode, title: 'Tracking' },
  switching: { cls: SwitchingMode, title: 'Target Switching' },
  duel: { cls: DuelMode, title: 'Strafe-Duell' },
};
