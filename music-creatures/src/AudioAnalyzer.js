export class AudioAnalyzer {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this.freqData = null;
    this.fftSize = 2048;

    // Band values (0-1 normalized)
    this.bass = 0;
    this.mid = 0;
    this.treble = 0;
    this.volume = 0;

    // Beat detection
    this.isBeat = false;
    this.beatThreshold = 1.15;
    this.beatDecay = 0.97;
    this.beatEnergy = 0;
    this.lastBeatTime = 0;
    this.beatCooldown = 120; // ms

    // BPM estimation
    this.beatTimes = [];
    this.bpm = 0;

    this.sourceType = null; // 'mic' | 'file'
  }

  _ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  _createAnalyser() {
    if (this.analyser) return;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = 0.75;
    const bufLen = this.analyser.frequencyBinCount;
    this.freqData = new Uint8Array(bufLen);
    this.dataArray = new Float32Array(this.analyser.fftSize);
  }

  _disconnect() {
    if (this.source) {
      try { this.source.disconnect(); } catch {}
      this.source = null;
    }
    if (this.analyser) {
      try { this.analyser.disconnect(); } catch {}
      this.analyser = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.sourceType = null;
  }

  async connectMicrophone() {
    this._ensureContext();
    this._disconnect();
    this._createAnalyser();

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.source = this.ctx.createMediaStreamSource(this.stream);
    // Connect to analyser only, NOT to destination (prevents feedback)
    this.source.connect(this.analyser);
    this.sourceType = 'mic';
  }

  connectAudioElement(audioEl) {
    this._ensureContext();
    this._disconnect();
    this._createAnalyser();

    this.source = this.ctx.createMediaElementSource(audioEl);
    this.source.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.sourceType = 'file';
  }

  disconnectMicrophone() {
    if (this.sourceType === 'mic') {
      this._disconnect();
    }
  }

  update() {
    if (!this.analyser || !this.freqData) return;

    this.analyser.getByteFrequencyData(this.freqData);

    const nyquist = this.ctx.sampleRate / 2;
    const binCount = this.analyser.frequencyBinCount;
    const binWidth = nyquist / binCount;

    // Frequency band indices
    const bassEnd = Math.min(Math.floor(250 / binWidth), binCount);
    const midEnd = Math.min(Math.floor(4000 / binWidth), binCount);
    const trebleEnd = Math.min(Math.floor(20000 / binWidth), binCount);
    const bassStart = Math.max(Math.floor(20 / binWidth), 0);
    const midStart = bassEnd;
    const trebleStart = midEnd;

    // Average each band
    this.bass = this._avgRange(bassStart, bassEnd);
    this.mid = this._avgRange(midStart, midEnd);
    this.treble = this._avgRange(trebleStart, trebleEnd);

    // RMS volume from time domain
    this.analyser.getFloatTimeDomainData(this.dataArray);
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i] * this.dataArray[i];
    }
    this.volume = Math.sqrt(sum / this.dataArray.length);

    // Beat detection on bass energy
    this._detectBeat();
  }

  _avgRange(start, end) {
    if (end <= start) return 0;
    let sum = 0;
    for (let i = start; i < end; i++) {
      sum += this.freqData[i];
    }
    return (sum / (end - start)) / 255;
  }

  _detectBeat() {
    const now = performance.now();
    const energy = this.bass * 0.7 + this.volume * 0.3;

    this.isBeat = false;

    if (energy > this.beatEnergy * this.beatThreshold && now - this.lastBeatTime > this.beatCooldown) {
      this.isBeat = true;
      this.lastBeatTime = now;
      this.beatEnergy = energy;

      // BPM tracking
      this.beatTimes.push(now);
      if (this.beatTimes.length > 20) this.beatTimes.shift();
      this._estimateBPM();
    }

    this.beatEnergy = Math.max(energy, this.beatEnergy * this.beatDecay);
  }

  _estimateBPM() {
    if (this.beatTimes.length < 4) return;
    const intervals = [];
    for (let i = 1; i < this.beatTimes.length; i++) {
      intervals.push(this.beatTimes[i] - this.beatTimes[i - 1]);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (avgInterval > 0) {
      const raw = 60000 / avgInterval;
      // Clamp to reasonable range
      this.bpm = raw >= 50 && raw <= 200 ? Math.round(raw) : this.bpm;
    }
  }
}
