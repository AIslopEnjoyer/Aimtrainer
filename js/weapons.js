// Apex-angelehnte Waffen mit Feuerrate, Magazin, Recoil-Pattern und Spread.
// Recoil = additiver Kick auf die Kamera (pitch/yaw), der nach Feuerpause zurückläuft.

export const WEAPONS = {
  r99: {
    name: 'R-99',
    auto: true,
    rpm: 1080,            // Schuss pro Minute
    magSize: 20,
    damage: 12,
    reloadTime: 1.85,
    // Recoil pro Schuss (Grad). Steigt an, leichte Seitwärtsbewegung.
    recoil: { up: 0.55, side: 0.28, upRamp: 0.02, maxUp: 1.4 },
    spread: 0.35,         // Streuung in Grad (Hüfte klein halten)
    recover: 9.0,         // wie schnell Recoil zurückläuft (1/s)
    pitchAudio: 1.15,
  },
  flatline: {
    name: 'VK-47 Flatline',
    auto: true,
    rpm: 600,
    magSize: 20,
    damage: 19,
    reloadTime: 2.4,
    recoil: { up: 0.95, side: 0.5, upRamp: 0.03, maxUp: 2.1 },
    spread: 0.28,
    recover: 6.0,
    pitchAudio: 0.85,
  },
  wingman: {
    name: 'Wingman',
    auto: false,
    rpm: 156,             // ~2.6 Schuss/Sek maximal
    magSize: 6,
    damage: 45,
    reloadTime: 2.1,
    recoil: { up: 1.9, side: 0.35, upRamp: 0.0, maxUp: 1.9 },
    spread: 0.05,
    recover: 5.0,
    pitchAudio: 0.7,
  },
};

export class Weapon {
  constructor(id) {
    this.set(id);
  }

  set(id) {
    this.id = id;
    this.def = WEAPONS[id] || WEAPONS.r99;
    this.mag = this.def.magSize;
    this.shotInterval = 60 / this.def.rpm; // Sekunden zwischen Schüssen
    this.cooldown = 0;
    this.reloading = false;
    this.reloadLeft = 0;
    this.shotsInBurst = 0; // für aufsteigendes Recoil
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.reloading) {
      this.reloadLeft -= dt;
      if (this.reloadLeft <= 0) {
        this.reloading = false;
        this.mag = this.def.magSize;
      }
    }
  }

  canFire() {
    return !this.reloading && this.cooldown <= 0 && this.mag > 0;
  }

  isEmpty() {
    return this.mag <= 0;
  }

  startReload() {
    if (this.reloading || this.mag === this.def.magSize) return false;
    this.reloading = true;
    this.reloadLeft = this.def.reloadTime;
    return true;
  }

  // Verbraucht einen Schuss und liefert den Recoil-Kick (Grad) + Spread zurück.
  fire() {
    this.mag--;
    this.cooldown = this.shotInterval;
    const r = this.def.recoil;
    const up = Math.min(r.maxUp, r.up + this.shotsInBurst * r.upRamp);
    // seitlicher Recoil pseudo-zufällig, aber leicht wellig
    const side = (Math.sin(this.shotsInBurst * 1.3) * 0.6 + (Math.random() - 0.5)) * r.side;
    this.shotsInBurst++;
    return {
      up,
      side,
      spread: this.def.spread,
      damage: this.def.damage,
    };
  }

  // Recoil-Burst zurücksetzen (bei Feuerpause).
  resetBurst() {
    this.shotsInBurst = 0;
  }
}
