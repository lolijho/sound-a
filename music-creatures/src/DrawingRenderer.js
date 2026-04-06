const PALETTE = ['#00ffe7', '#ff2d78', '#ffd200', '#bf5fff'];

class Pencil {
  constructor(canvasW, canvasH) {
    this.x = Math.random() * canvasW;
    this.y = Math.random() * canvasH;
    this.angle = Math.random() * Math.PI * 2;
    this.color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    this.lineWidth = 1.5 + Math.random() * 2;
    this.speed = 1 + Math.random() * 1.5;
    this.turnRate = 0.02 + Math.random() * 0.03;
    this.phase = Math.random() * Math.PI * 2;
    this.history = [{ x: this.x, y: this.y }];
    this.maxHistory = 300;
  }

  update(dt, bass, mid, treble, isBeat, canvasW, canvasH) {
    // Mid controls speed, treble controls turn intensity
    const spd = this.speed * (1 + mid * 4) * dt * 60;
    const turn = this.turnRate * (1 + treble * 6);

    // Organic wandering driven by audio
    this.phase += dt * (1 + bass * 3);
    this.angle += Math.sin(this.phase) * turn;
    this.angle += (Math.random() - 0.5) * turn * 0.5;

    // Beat: sharp direction change
    if (isBeat) {
      this.angle += (Math.random() - 0.5) * Math.PI * 0.6;
      this.lineWidth = 2 + bass * 4;
    }

    this.x += Math.cos(this.angle) * spd;
    this.y += Math.sin(this.angle) * spd;

    // Wrap around edges
    if (this.x < 0) this.x += canvasW;
    if (this.x > canvasW) this.x -= canvasW;
    if (this.y < 0) this.y += canvasH;
    if (this.y > canvasH) this.y -= canvasH;

    this.history.push({ x: this.x, y: this.y });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Slowly restore line width
    this.lineWidth = Math.max(1.5, this.lineWidth * 0.995);
  }

  draw(ctx, treble) {
    if (this.history.length < 2) return;

    const len = this.history.length;
    for (let i = 1; i < len; i++) {
      const prev = this.history[i - 1];
      const curr = this.history[i];

      // Skip if the point wrapped around the screen
      const dx = Math.abs(curr.x - prev.x);
      const dy = Math.abs(curr.y - prev.y);
      if (dx > 200 || dy > 200) continue;

      const alpha = (i / len) * (0.4 + treble * 0.5);
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.lineWidth * (i / len);
      ctx.globalAlpha = alpha;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 4 + treble * 8;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // Draw pencil tip
    const tip = this.history[len - 1];
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 3 + treble * 3, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

export class DrawingRenderer {
  constructor(canvasW, canvasH) {
    this.pencils = [];
    this.init(canvasW, canvasH);
  }

  init(canvasW, canvasH) {
    this.pencils = [];
    const count = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      this.pencils.push(new Pencil(canvasW, canvasH));
    }
  }

  update(dt, bass, mid, treble, isBeat, canvasW, canvasH) {
    for (const p of this.pencils) {
      p.update(dt, bass, mid, treble, isBeat, canvasW, canvasH);
    }
  }

  draw(ctx, treble) {
    for (const p of this.pencils) {
      p.draw(ctx, treble);
    }
  }
}
