const COLORS = ['#00ffe7', '#ff2d78', '#ffd200', '#bf5fff'];

class GeoParticle {
  constructor(x, y) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 4;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = 1;
    this.decay = 0.01 + Math.random() * 0.02;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.15;
    this.size = 3 + Math.random() * 5;
    this.sides = 3 + Math.floor(Math.random() * 4);
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
  }

  update(dt) {
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
    this.rotation += this.rotSpeed * dt * 60;
    this.life -= this.decay * dt * 60;
    this.vx *= 0.99;
    this.vy *= 0.99;
  }

  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.globalAlpha = this.life;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let i = 0; i <= this.sides; i++) {
      const a = (i / this.sides) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * this.size;
      const py = Math.sin(a) * this.size;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

class Ring {
  constructor(x, y, sides) {
    this.x = x;
    this.y = y;
    this.radius = 20;
    this.maxRadius = 200 + Math.random() * 150;
    this.speed = 2 + Math.random() * 2;
    this.life = 1;
    this.sides = sides || (3 + Math.floor(Math.random() * 5));
    this.rotation = Math.random() * Math.PI * 2;
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
  }

  update(dt) {
    this.radius += this.speed * dt * 60;
    this.life = Math.max(0, 1 - this.radius / this.maxRadius);
    this.rotation += 0.005 * dt * 60;
  }

  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.globalAlpha = this.life * 0.7;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    for (let i = 0; i <= this.sides; i++) {
      const a = (i / this.sides) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * this.radius;
      const py = Math.sin(a) * this.radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

export class GeometryRenderer {
  constructor() {
    this.particles = [];
    this.rings = [];
    this.barCount = 128;
  }

  onBeat(cx, cy, canvasW, canvasH) {
    // Spawn ring at a random position on screen
    const rx = Math.random() * canvasW;
    const ry = Math.random() * canvasH;
    this.rings.push(new Ring(rx, ry));

    // Also one at center sometimes
    if (Math.random() < 0.4) {
      this.rings.push(new Ring(cx, cy));
    }

    // Burst particles at multiple random spots
    const spots = 2 + Math.floor(Math.random() * 3);
    for (let s = 0; s < spots; s++) {
      const sx = Math.random() * canvasW;
      const sy = Math.random() * canvasH;
      const count = 4 + Math.floor(Math.random() * 6);
      for (let i = 0; i < count; i++) {
        this.particles.push(new GeoParticle(sx, sy));
      }
    }
  }

  update(dt) {
    for (const p of this.particles) p.update(dt);
    for (const r of this.rings) r.update(dt);
    this.particles = this.particles.filter(p => p.life > 0);
    this.rings = this.rings.filter(r => r.life > 0);
  }

  drawBars(ctx, freqData, canvasW, canvasH) {
    if (!freqData) return;
    const count = Math.min(this.barCount, freqData.length);
    const barW = canvasW / count;
    const maxH = canvasH * 0.35;

    for (let i = 0; i < count; i++) {
      const val = freqData[i] / 255;
      const h = val * maxH;
      const hue = (i / count) * 300;
      ctx.fillStyle = `hsl(${hue}, 100%, ${50 + val * 30}%)`;
      ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
      ctx.shadowBlur = 6;
      ctx.fillRect(i * barW, canvasH - h, barW - 1, h);
    }
    ctx.shadowBlur = 0;
  }

  drawPolygons(ctx, canvasW, canvasH, bass, mid) {
    const now = performance.now();

    // Multiple polygons scattered across the screen
    const positions = [
      { x: canvasW * 0.5, y: canvasH * 0.5, scale: 1 },
      { x: canvasW * 0.15, y: canvasH * 0.25, scale: 0.5 },
      { x: canvasW * 0.85, y: canvasH * 0.2, scale: 0.45 },
      { x: canvasW * 0.2, y: canvasH * 0.75, scale: 0.55 },
      { x: canvasW * 0.8, y: canvasH * 0.8, scale: 0.4 },
      { x: canvasW * 0.5, y: canvasH * 0.15, scale: 0.35 },
    ];

    const sidesArr = [6, 3, 5, 4, 7, 8];

    for (let p = 0; p < positions.length; p++) {
      const pos = positions[p];
      const sides = sidesArr[p % sidesArr.length];
      const baseR = 30 * pos.scale;
      const r = baseR + bass * 50 * pos.scale + mid * 15 * pos.scale;
      const rotation = now * (0.0002 + p * 0.00008) * (p % 2 === 0 ? 1 : -1);
      const color = COLORS[p % COLORS.length];

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(rotation);
      ctx.beginPath();
      for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 15 + bass * 15;
      ctx.stroke();

      ctx.globalAlpha = 0.06 + bass * 0.08;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  drawEffects(ctx) {
    for (const r of this.rings) r.draw(ctx);
    for (const p of this.particles) p.draw(ctx);
  }
}
