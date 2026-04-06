const PALETTE = ['#00ffe7', '#ff2d78', '#ffd200', '#bf5fff'];

class Tentacle {
  constructor(numSegments, segLen) {
    this.segments = [];
    this.segLen = segLen;
    for (let i = 0; i < numSegments; i++) {
      this.segments.push({ x: 0, y: 0, angle: 0 });
    }
    this.phase = Math.random() * Math.PI * 2;
    this.waveSpeed = 1.5 + Math.random() * 1.5;
    this.waveAmp = 0.3 + Math.random() * 0.3;
  }

  update(baseX, baseY, baseAngle, time, treble) {
    // First segment follows the base
    this.segments[0].x = baseX;
    this.segments[0].y = baseY;
    this.segments[0].angle = baseAngle;

    for (let i = 1; i < this.segments.length; i++) {
      const prev = this.segments[i - 1];
      const wave = Math.sin(time * this.waveSpeed + i * 0.6 + this.phase) * this.waveAmp * (1 + treble * 2);
      const angle = prev.angle + wave;
      this.segments[i].x = prev.x + Math.cos(angle) * this.segLen;
      this.segments[i].y = prev.y + Math.sin(angle) * this.segLen;
      this.segments[i].angle = angle;
    }
  }

  draw(ctx, color, alpha) {
    if (this.segments.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(this.segments[0].x, this.segments[0].y);
    for (let i = 1; i < this.segments.length; i++) {
      ctx.lineTo(this.segments[i].x, this.segments[i].y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}

export class Butterfly {
  constructor(canvasW, canvasH) {
    this.x = Math.random() * canvasW;
    this.y = Math.random() * canvasH;
    this.vx = (Math.random() - 0.5) * 1.5;
    this.vy = (Math.random() - 0.5) * 1.5;
    this.baseSpeed = 0.8 + Math.random() * 0.8;
    this.color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    this.color2 = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    this.time = Math.random() * 100;
    this.wingSize = 14 + Math.random() * 12;
    this.flapSpeed = 6 + Math.random() * 4; // base flap speed
    this.phase = Math.random() * Math.PI * 2;
    this.bodyLen = 8 + Math.random() * 6;
    this.heading = Math.random() * Math.PI * 2;
  }

  update(dt, bass, mid, treble, isBeat, canvasW, canvasH) {
    this.time += dt;

    // Mid controls speed
    const speed = this.baseSpeed * (1 + mid * 3);

    // Gentle wandering
    this.heading += (Math.sin(this.time * 0.7 + this.phase) * 0.03 + (Math.random() - 0.5) * 0.05) * dt * 60;

    this.vx = Math.cos(this.heading) * speed;
    this.vy = Math.sin(this.heading) * speed;

    // Beat burst
    if (isBeat) {
      this.heading += (Math.random() - 0.5) * Math.PI * 0.5;
      this.vx += Math.cos(this.heading) * (1.5 + bass * 3);
      this.vy += Math.sin(this.heading) * (1.5 + bass * 3);
    }

    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;

    // Bounce off edges
    const margin = 40;
    if (this.x < margin) { this.x = margin; this.heading = Math.PI - this.heading; }
    if (this.x > canvasW - margin) { this.x = canvasW - margin; this.heading = Math.PI - this.heading; }
    if (this.y < margin) { this.y = margin; this.heading = -this.heading; }
    if (this.y > canvasH - margin) { this.y = canvasH - margin; this.heading = -this.heading; }
  }

  draw(ctx, treble, bass) {
    // Wing flap: bass makes flapping faster, treble makes wings bigger
    const flapAngle = Math.sin(this.time * this.flapSpeed * (1 + bass * 3)) * (0.6 + treble * 0.4);
    const wingW = this.wingSize * (1 + treble * 0.5);
    const wingH = wingW * 1.3;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.heading + Math.PI / 2); // point body in direction of travel

    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, 2, this.bodyLen * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.fill();

    // Left upper wing
    ctx.save();
    ctx.scale(Math.cos(flapAngle), 1); // flap perspective
    this._drawWing(ctx, -wingW * 0.5, -wingH * 0.3, wingW, wingH * 0.7, this.color);
    ctx.restore();

    // Right upper wing
    ctx.save();
    ctx.scale(-Math.cos(flapAngle), 1);
    this._drawWing(ctx, -wingW * 0.5, -wingH * 0.3, wingW, wingH * 0.7, this.color);
    ctx.restore();

    // Left lower wing (smaller)
    ctx.save();
    ctx.scale(Math.cos(flapAngle + 0.3), 1);
    this._drawWing(ctx, -wingW * 0.35, 0, wingW * 0.7, wingH * 0.5, this.color2);
    ctx.restore();

    // Right lower wing
    ctx.save();
    ctx.scale(-Math.cos(flapAngle + 0.3), 1);
    this._drawWing(ctx, -wingW * 0.35, 0, wingW * 0.7, wingH * 0.5, this.color2);
    ctx.restore();

    // Antennae
    ctx.beginPath();
    ctx.moveTo(-1, -this.bodyLen * 0.4);
    ctx.quadraticCurveTo(-wingW * 0.3, -this.bodyLen * 0.8, -wingW * 0.2, -this.bodyLen * 0.9);
    ctx.moveTo(1, -this.bodyLen * 0.4);
    ctx.quadraticCurveTo(wingW * 0.3, -this.bodyLen * 0.8, wingW * 0.2, -this.bodyLen * 0.9);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  _drawWing(ctx, x, y, w, h, color) {
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, y + h * 0.5, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.fill();

    // Wing edge glow
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.7;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
}

export class Creature {
  constructor(canvasW, canvasH) {
    this.x = Math.random() * canvasW;
    this.y = Math.random() * canvasH;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 2;
    this.baseSpeed = 0.5 + Math.random() * 0.5;
    this.radius = 12 + Math.random() * 10;
    this.baseRadius = this.radius;
    this.color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    this.time = Math.random() * 100;

    // Tentacles
    const numTentacles = 4 + Math.floor(Math.random() * 4);
    const segLen = 8 + Math.random() * 6;
    const numSegs = 8 + Math.floor(Math.random() * 6);
    this.tentacles = [];
    this.tentacleAngles = [];
    for (let i = 0; i < numTentacles; i++) {
      this.tentacles.push(new Tentacle(numSegs, segLen));
      this.tentacleAngles.push((i / numTentacles) * Math.PI * 2);
    }
  }

  update(dt, bass, mid, treble, isBeat, canvasW, canvasH) {
    this.time += dt;

    // Mid controls movement speed
    const speed = this.baseSpeed * (1 + mid * 3);
    const mag = Math.sqrt(this.vx * this.vx + this.vy * this.vy) || 1;
    this.vx = (this.vx / mag) * speed;
    this.vy = (this.vy / mag) * speed;

    // Beat burst
    if (isBeat) {
      const angle = Math.random() * Math.PI * 2;
      this.vx += Math.cos(angle) * (2 + bass * 4);
      this.vy += Math.sin(angle) * (2 + bass * 4);
    }

    // Damping
    this.vx *= 0.98;
    this.vy *= 0.98;

    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;

    // Bounce off edges
    const margin = 30;
    if (this.x < margin) { this.x = margin; this.vx = Math.abs(this.vx); }
    if (this.x > canvasW - margin) { this.x = canvasW - margin; this.vx = -Math.abs(this.vx); }
    if (this.y < margin) { this.y = margin; this.vy = Math.abs(this.vy); }
    if (this.y > canvasH - margin) { this.y = canvasH - margin; this.vy = -Math.abs(this.vy); }

    // Bass pulses the nucleus
    this.radius = this.baseRadius * (1 + bass * 0.8);

    // Update tentacles
    for (let i = 0; i < this.tentacles.length; i++) {
      const angle = this.tentacleAngles[i] + Math.sin(this.time * 0.5 + i) * 0.3;
      const bx = this.x + Math.cos(angle) * this.radius;
      const by = this.y + Math.sin(angle) * this.radius;
      this.tentacles[i].update(bx, by, angle, this.time, treble);
    }
  }

  draw(ctx, treble) {
    // Nucleus glow
    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius * 2.5);
    grad.addColorStop(0, this.color);
    grad.addColorStop(0.4, this.color + '88');
    grad.addColorStop(1, 'transparent');

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 25 + treble * 20;
    ctx.fill();

    // Core
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Tentacles
    const alpha = 0.5 + treble * 0.5;
    for (const t of this.tentacles) {
      t.draw(ctx, this.color, alpha);
    }
  }
}
