document.addEventListener('DOMContentLoaded', () => {
  // ------------------------------
  // 0) Logování do "Výsledky"
  // ------------------------------
  let feed = document.getElementById('feed');
  function logToFeed(text) {
    const row = document.createElement('div');
    row.className = 'item';
    const meta = document.createElement('div');
    meta.className = 'meta sys';
    meta.textContent = new Date().toLocaleTimeString() + ' · ' + text;
    row.appendChild(meta);
    (feed || document.body).appendChild(row);
    try { (feed || document.body).scrollTop = (feed || document.body).scrollHeight; } catch {}
  }
  window.addEventListener('error', (e) => logToFeed('Chyba: ' + (e.message || e)));
  logToFeed('📦 client.js start');

  // ------------------------------
  // 1) DOM prvky
  // ------------------------------
  const $ = (id) => document.getElementById(id);
  const playerInput = $('playerInput');
  const roomInput   = $('roomInput');
  const joinBtn     = $('joinBtn');
  const shareBtn    = $('shareBtn');
  const sidesSelect = $('sidesSelect');
  const countInput  = $('countInput');
  const modInput    = $('modInput');
  const rollBtn     = $('rollBtn');

  // volitelná tlačítka (pokud v HTML nejsou, budou null a nic se neděje)
  const advBtn      = $('advBtn');
  const disBtn      = $('disBtn');
  const muteBtn     = $('muteBtn');
  const exportBtn   = $('exportBtn');

  const missing = [playerInput, roomInput, joinBtn, shareBtn, sidesSelect, countInput, modInput, rollBtn, feed]
    .filter(x => !x).length;
  if (missing) { logToFeed('❌ Chybí ' + missing + ' prvků v HTML (zkontroluj ID).'); return; }
  logToFeed('✅ DOM prvky OK');

  // ------------------------------
  // 2) 3D init (neblokuje nic)
  // ------------------------------
  if (window.Dice3D) {
    try { Dice3D.init('dice3d'); logToFeed('🧊 3D inicializováno'); }
    catch (e) { logToFeed('3D chyba: ' + e.message); }
  }

  // ------------------------------
  // 3) WebAudio (žádný soubor, žádné stahování)
  // ------------------------------
  let audioCtx, masterGain, audioReady = false;
  let muted = (localStorage.getItem('muted') === '1');

  function initAudio() {
    if (audioReady) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return; // starý prohlížeč
    audioCtx = new Ctx();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = muted ? 0 : 0.8;
    masterGain.connect(audioCtx.destination);
    audioReady = true;
  }
  // povolíme až po prvním kliknutí uživatele (autoplay policy)
  window.addEventListener('click', () => {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    initAudio();
  }, { once: true });

  function updateMuteUI(){
    if (!muteBtn) return;
    muteBtn.textContent = muted ? '🔇 Zvuk' : '🔊 Zvuk';
    if (masterGain) masterGain.gain.value = muted ? 0 : 0.8;
  }
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      muted = !muted; localStorage.setItem('muted', muted ? '1' : '0'); updateMuteUI();
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      initAudio();
    });
    updateMuteUI();
  }

  // krátký „dice roll“: šum + pár ťuknutí
  function playRollSound() {
    if (muted) return;
    initAudio();
    if (!audioCtx) return;

    const ctx = audioCtx;
    const now = ctx.currentTime;

    // decaying noise (chřestění)
    const dur = 0.55;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      data[i] = (Math.random() * 2 - 1) * (1 - t) * 0.6;
    }
    const noise = ctx.createBufferSource(); noise.buffer = buffer;

    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 0.7;
    const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 2500;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.6, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    noise.connect(bp); bp.connect(lpf); lpf.connect(g); g.connect(masterGain);
    noise.start(now); noise.stop(now + dur);

    // 2–3 rychlá "ťuknutí"
    const taps = 3;
    for (let j = 0; j < taps; j++) {
      const t = now + 0.08 + j * 0.09 + Math.random() * 0.03;
      const o = ctx.createOscillator(); o.type = 'triangle';
      const og = ctx.createGain();
      o.frequency.setValueAtTime(360 - j * 80 + Math.random() * 40, t);
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(og); og.connect(masterGain);
      o.start(t); o.stop(t + 0.08);
    }
  }

  // ------------------------------
  // 4) Pomoc: načtení Socket.IO (fallback)
  // ------------------------------
  function ensureSocketIO() {
    return new Promise((resolve) => {
      if (window.io) return resolve(true);
      logToFeed('ℹ️ window.io chybí – zkusím načíst /socket.io/socket.io.js');
      const s = document.createElement('script');
      s.src = '/socket.io/socket.io.js';
      s.onload = () => resolve(!!window.io);
      s.onerror = () => {
        const s2 = document.createElement('script');
        s2.src = location.origin + '/socket.io/socket.io.js';
        s2.onload = () => resolve(!!window.io);
        s2.onerror = () => resolve(false);
        document.head.appendChild(s2);
      };
      document.head.appendChild(s);
    });
  }

  // ------------------------------
  // 5) Notace + render řádku výsledku
  // ------------------------------
  function formatNotation(count, sides, mod, mode) {
    const kind = (mode === 'adv' && sides === 20) ? 'adv'
               : (mode === 'dis' && sides === 20) ? 'dis'
               : '';
    const base = kind ? `${count}×(d${sides} ${kind})` : `${count}d${sides}`;
    if (!mod || mod === 0) return base;
    const sign = mod > 0 ? '+' : '';
    return `${base} ${sign}${mod}`;
  }

  function addResultItem(res) {
    const div = document.createElement('div');
    div.className = 'item';

    const meta = document.createElement('div');
    meta.className = 'meta';
    const who = document.createElement('div'); who.textContent = res.player;
    const when = document.createElement('div'); when.textContent = new Date(res.ts).toLocaleTimeString();
    meta.appendChild(who); meta.appendChild(when);

    const resLine = document.createElement('div');
    resLine.className = 'res';

    const notation = document.createElement('span');
    notation.className = 'badge';
    notation.textContent = formatNotation(res.count, res.sides, res.modifier, res.mode);

    const rollsWrap = document.createElement('span');
    const ANIM_TICKS = 12, TICK_MS = 50;
    res.rolls.forEach((finalVal) => {
      const d = document.createElement('span');
      d.className = 'die rolling';
      let t = 0;
      const flicker = setInterval(() => {
        d.textContent = 1 + Math.floor(Math.random() * res.sides);
        if (++t >= ANIM_TICKS) {
          clearInterval(flicker);
          d.classList.remove('rolling');
          d.textContent = finalVal;
          if (res.sides === 20) {
            if (finalVal === 20) d.classList.add('nat20');
            if (finalVal === 1)  d.classList.add('nat1');
          }
        }
      }, TICK_MS);
      rollsWrap.appendChild(d);
    });

    const total = document.createElement('span');
    total.className = 'total';
    total.textContent = `Celkem: ${res.total}`;

    resLine.appendChild(notation);
    resLine.appendChild(rollsWrap);
    resLine.appendChild(total);

    div.appendChild(meta);
    div.appendChild(resLine);
    (feed || document.body).appendChild(div);
    try { (feed || document.body).scrollTop = (feed || document.body).scrollHeight; } catch {}
  }

  // historie pro export
  const HISTORY = [];
  function exportCSV() {
    if (!HISTORY.length) { logToFeed('ℹ️ Zatím není co exportovat.'); return; }
    const header = ['time','player','room','sides','count','modifier','mode','rolls','subtotal','total'];
    const rows = HISTORY.map(r => [
      new Date(r.ts).toISOString(),
      r.player, r.room, r.sides, r.count, r.modifier, r.mode, `"${r.rolls}"`, r.subtotal, r.total
    ]);
    const csv = [header.join(','), ...rows.map(a => a.join(','))].join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'dice-history.csv'; a.click();
    URL.revokeObjectURL(url);
  }
  if (exportBtn) exportBtn.addEventListener('click', exportCSV);

  // ------------------------------
  // 6) Socket + UI
  // ------------------------------
  let socket = null;

  function joinRoom() {
    const player = (playerInput.value || '').trim() || 'Hráč';
    const room = (roomInput.value || '').trim() || 'stul-1';
    localStorage.setItem('playerName', player);
    if (socket) {
      socket.emit('join-room', { room, player });
      logToFeed(`📡 Poslán join-room: ${room} (${player})`);
    } else {
      logToFeed('❌ Nelze poslat join-room – socket není k dispozici');
    }
    const url = new URL(location.href);
    url.searchParams.set('room', room);
    history.replaceState(null, '', url.toString());
  }

  function sendRoll(mode) {
    const sides = parseInt(sidesSelect.value, 10);
    const count = Math.min(10, Math.max(1, parseInt(countInput.value || '1', 10)));
    const modifier = Math.min(99, Math.max(-99, parseInt(modInput.value || '0', 10)));
    socket.emit('roll-dice', { sides, count, modifier, mode });
    logToFeed(`🎯 roll-dice odeslán (${count}d${sides}${modifier? (modifier>0?'+':'')+modifier : ''}${mode ? ' '+mode : ''})`);
  }

  ensureSocketIO().then((ok) => {
    if (!ok) { logToFeed('❌ Nepodařilo se načíst Socket.IO klienta'); return; }

    socket = io();
    socket.on('connect',       () => logToFeed('✅ Připojeno k serveru (' + socket.id + ')'));
    socket.on('connect_error', (e) => logToFeed('⚠️ connect_error: ' + (e && e.message)));
    socket.on('joined', ({ room, player }) => logToFeed(`✅ Připojeno ke stolu „${room}“ jako ${player}.`));
    socket.on('system', (msg) => logToFeed((msg && msg.text) || 'system'));
    socket.on('dice-result', (res) => {
      // >>> ZVUK ZDE <<<
      playRollSound();

      // uložit pro export
      HISTORY.push({
        ts: res.ts, player: res.player, room: res.room,
        sides: res.sides, count: res.count, modifier: res.modifier, mode: res.mode,
        rolls: res.rolls.join(' '), subtotal: res.subtotal, total: res.total
      });

      // vykreslit do feedu + 3D
      addResultItem(res);
      if (window.Dice3D) { try { Dice3D.roll(res.sides, res.rolls); } catch (e) { logToFeed('3D roll chyba: ' + e.message); } }
    });

    // UI handlers
    joinBtn.addEventListener('click', joinRoom);
    playerInput.addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });
    roomInput.addEventListener('keydown',  e => { if (e.key === 'Enter') joinRoom(); });

    shareBtn.addEventListener('click', async () => {
      const url = new URL(location.href);
      url.searchParams.set('room', (roomInput.value || 'stul-1').trim());
      try { await navigator.clipboard.writeText(url.toString()); logToFeed('🔗 Odkaz zkopírován'); }
      catch { logToFeed('⚠️ Nepodařilo se zkopírovat odkaz'); }
    });

    rollBtn.addEventListener('click', () => sendRoll(undefined));
    if (advBtn) advBtn.addEventListener('click', () => { sidesSelect.value = '20'; sendRoll('adv'); });
    if (disBtn) disBtn.addEventListener('click', () => { sidesSelect.value = '20'; sendRoll('dis'); });

    // Auto-join
    playerInput.value = localStorage.getItem('playerName') || playerInput.value || '';
    const params = new URLSearchParams(location.search);
    roomInput.value = params.get('room') || roomInput.value || 'stul-1';
    joinRoom();
    logToFeed('▶️ joinRoom() spuštěn (auto)');
  });
});
