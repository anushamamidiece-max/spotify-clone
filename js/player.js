/* Local-audio playback engine. Every catalog item points to an original bundled audio preview. */
(() => {
  class AudioPlayer {
    constructor(tracks) {
      this.tracks = tracks;
      this.index = 0;
      this.playing = false;
      this.shuffle = false;
      this.repeat = 'off';
      this.volume = 0.72;
      this.muted = false;
      this.liked = new Set(['midnight-code']);
      this.time = 0;
      this.timer = null;
      this.audio = new Audio();
      this.audio.preload = 'metadata';
      this.audio.volume = this.volume;
      this.audio.addEventListener('loadedmetadata', () => {
        if (Number.isFinite(this.audio.duration) && this.audio.duration > 0) this.track.duration = this.audio.duration;
        this.paintProgress();
      });
      this.audio.addEventListener('timeupdate', () => { this.time = this.audio.currentTime || 0; this.paintProgress(); });
      this.audio.addEventListener('ended', () => {
        if (this.repeat === 'one') { this.audio.currentTime = 0; this.play(); }
        else this.next(true);
      });
      this.audio.addEventListener('error', () => {
        this.playing = false;
        this.paint();
        window.SonoraApp?.toast('Audio preview could not load. Please use a local web server.');
      });
    }
    get track() { return this.tracks[this.index]; }
    init() { this.loadSource(); this.paint(); this.bind(); }
    loadSource() {
      this.audio.pause();
      this.audio.src = this.track.audio;
      this.audio.load();
      this.time = 0;
    }
    bind() {
      document.addEventListener('click', e => {
        const action = e.target.closest('[data-player-action]')?.dataset.playerAction;
        if (!action) return;
        const actions = {
          toggle: () => this.toggle(), next: () => this.next(), previous: () => this.previous(),
          shuffle: () => this.toggleShuffle(), repeat: () => this.toggleRepeat(), mute: () => this.toggleMute(),
          like: () => this.toggleLike(), lyrics: () => window.SonoraApp?.openLyrics(), queue: () => window.SonoraApp?.toggleQueue()
        };
        actions[action]?.();
      });
      document.addEventListener('pointerdown', e => {
        const target = e.target.closest('[data-range]');
        if (!target) return;
        this.updateRangeFromPointer(target, e);
        const move = ev => this.updateRangeFromPointer(target, ev);
        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
      });
    }
    updateRangeFromPointer(el, event) {
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      if (el.dataset.range === 'progress') {
        this.time = this.track.duration * ratio;
        this.audio.currentTime = this.time;
      } else {
        this.volume = ratio;
        this.muted = ratio === 0;
        this.audio.volume = ratio;
        this.audio.muted = this.muted;
      }
      this.paintProgress();
    }
    toggle() { this.playing ? this.pause() : this.play(); }
    async play() {
      try {
        await this.audio.play();
        this.playing = true;
        this.startFramePaint();
        this.paint();
        window.SonoraApp?.toast(`Playing original preview: “${this.track.title}”`);
      } catch (_) {
        this.playing = false;
        this.paint();
        window.SonoraApp?.toast('Press play again to start this local audio preview.');
      }
    }
    pause() { this.audio.pause(); this.playing = false; cancelAnimationFrame(this.timer); this.paint(); }
    startFramePaint() {
      cancelAnimationFrame(this.timer);
      const update = () => {
        if (!this.playing) return;
        this.time = this.audio.currentTime || 0;
        this.paintProgress();
        this.timer = requestAnimationFrame(update);
      };
      this.timer = requestAnimationFrame(update);
    }
    next(silent=false) {
      let next = this.index + 1;
      if (this.shuffle && this.tracks.length > 1) while (next === this.index) next = Math.floor(Math.random() * this.tracks.length);
      this.index = next % this.tracks.length;
      const shouldPlay = this.playing;
      this.loadSource(); this.paint();
      if (shouldPlay) this.play();
      else if (!silent) window.SonoraApp?.toast(`Next up: ${this.track.title}`);
    }
    previous() {
      if (this.time > 3) { this.audio.currentTime = 0; this.time = 0; this.paintProgress(); return; }
      this.index = (this.index - 1 + this.tracks.length) % this.tracks.length;
      const shouldPlay = this.playing;
      this.loadSource(); this.paint();
      if (shouldPlay) this.play();
    }
    load(id, autoPlay = true) {
      const i = this.tracks.findIndex(t => t.id === id); if (i < 0) return;
      this.index = i;
      this.loadSource(); this.paint();
      if (autoPlay) this.play();
    }
    toggleShuffle() { this.shuffle = !this.shuffle; this.paint(); window.SonoraApp?.toast(this.shuffle ? 'Shuffle is on' : 'Shuffle is off'); }
    toggleRepeat() { this.repeat = this.repeat === 'off' ? 'all' : this.repeat === 'all' ? 'one' : 'off'; this.paint(); window.SonoraApp?.toast(this.repeat === 'off' ? 'Repeat is off' : this.repeat === 'one' ? 'Repeat one' : 'Repeat all'); }
    toggleLike(id = this.track.id) { if (this.liked.has(id)) { this.liked.delete(id); window.SonoraApp?.toast('Removed from Liked Songs'); } else { this.liked.add(id); window.SonoraApp?.toast('Added to Liked Songs'); } this.paint(); window.SonoraApp?.refreshLikes?.(); }
    toggleMute() { this.muted = !this.muted; this.audio.muted = this.muted; this.paintProgress(); }
    isLiked(id) { return this.liked.has(id); }
    paint() {
      const t = this.track;
      document.querySelectorAll('[data-player-title]').forEach(el => el.textContent = t.title);
      document.querySelectorAll('[data-player-artist]').forEach(el => el.textContent = t.artist);
      document.querySelectorAll('[data-player-cover]').forEach(el => { el.src = t.art; el.alt = `${t.title} artwork`; });
      document.querySelectorAll('[data-player-language]').forEach(el => el.textContent = t.language || 'Original audio');
      document.querySelectorAll('[data-player-action="toggle"]').forEach(el => { el.setAttribute('aria-label', this.playing ? 'Pause' : 'Play'); el.innerHTML = window.SonoraIcons[this.playing ? 'pause' : 'play']; });
      document.querySelectorAll('[data-player-action="like"]').forEach(el => { el.classList.toggle('active',this.isLiked(t.id)); el.innerHTML = window.SonoraIcons.heart(this.isLiked(t.id)); });
      document.querySelectorAll('[data-player-action="shuffle"]').forEach(el => el.classList.toggle('active', this.shuffle));
      document.querySelectorAll('[data-player-action="repeat"]').forEach(el => { el.classList.toggle('active',this.repeat !== 'off'); el.innerHTML = window.SonoraIcons.repeat + (this.repeat === 'one' ? '<span class="active-dot"></span>' : ''); });
      document.querySelectorAll('.eq-holder').forEach(el => { el.innerHTML = this.playing ? '<span class="equalizer"><i></i><i></i><i></i></span>' : ''; });
      document.querySelectorAll('[data-track-row]').forEach(row => row.classList.toggle('now-playing', row.dataset.trackRow === t.id));
      this.paintProgress();
    }
    paintProgress() {
      const d = this.track.duration || 22, ratio = Math.max(0,Math.min(1,this.time/d))*100;
      document.querySelectorAll('[data-progress-fill]').forEach(el => el.style.width = `${ratio}%`);
      document.querySelectorAll('[data-progress-thumb]').forEach(el => el.style.left = `${ratio}%`);
      document.querySelectorAll('[data-current-time]').forEach(el => el.textContent = this.format(this.time));
      document.querySelectorAll('[data-duration]').forEach(el => el.textContent = this.format(d));
      const vol = this.muted ? 0 : this.volume * 100;
      document.querySelectorAll('[data-volume-fill]').forEach(el => el.style.width = `${vol}%`);
      document.querySelectorAll('[data-volume-thumb]').forEach(el => el.style.left = `${vol}%`);
      document.querySelectorAll('[data-player-action="mute"]').forEach(el => el.innerHTML = window.SonoraIcons[this.muted || this.volume === 0 ? 'volumeX' : 'volume']);
    }
    format(s) { s = Math.floor(s); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }
  }
  window.VisualPlayer = AudioPlayer;
})();
