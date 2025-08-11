document.addEventListener('DOMContentLoaded', () => {
  // --- Logování do "Výsledky" (fallback do body, ať vždy něco vidíš) ---
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

  // --- 3D init (neblokuje nic) ---
  if (window.Dice3D) {
    try { Dice3D.init('dice3d'); logToFeed('🧊 3D inicializováno'); }
    catch (e) { logToFeed('3D chyba: ' + e.message); }
  }

  // --- DOM prvky ---
  const $ = (id) => document.getElementById(id);
  const playerInput = $('playerInput');
  const roomInput   = $('roomInput');
  const joinBtn     = $('joinBtn');
  const shareBtn    = $('shareBtn');
  const sidesSelect = $('sidesSelect');
  const countInput  = $('countInput');
  const modInput    = $('modInput');
  const rollBtn     = $('rollBtn');
  const advBtn    = $('advBtn');
const disBtn    = $('disBtn');
const muteBtn   = $('muteBtn');
const exportBtn = $('exportBtn');

const HISTORY = []; // budeme plnit pro CSV export


  const missing = [playerInput, roomInput, joinBtn, shareBtn, sidesSelect, countInput, modInput, rollBtn, feed].filter(x => !x).length;
  if (missing) { logToFeed('❌ Chybí ' + missing + ' prvků v HTML (zkontroluj ID).'); return; }
  logToFeed('✅ DOM prvky OK');

  // --- Pomoc: jisté načtení Socket.IO klienta, i kdyby ho prohlížeč/rozšíření nechtěl načíst ---
  function ensureSocketIO() {
    return new Promise((resolve) => {
      if (window.io) return resolve(true);

      logToFeed('ℹ️ window.io chybí – zkusím dynamicky načíst /socket.io/socket.io.js');
      const s = document.createElement('script');
      s.src = '/socket.io/socket.io.js';
      s.onload = () => resolve(!!window.io);
      s.onerror = () => {
        // poslední pokus: absolutní URL (někdy pomůže proti rozšířením)
        const s2 = document.createElement('script');
        s2.src = location.origin + '/socket.io/socket.io.js';
        s2.onload = () => resolve(!!window.io);
        s2.onerror = () => resolve(false);
        document.head.appendChild(s2);
      };
      document.head.appendChild(s);
    });
  }

  // --- Připojení + UI po zajištění Socket.IO ---
  let socket = null;

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
function formatNotation(count, sides, mod, mode) {
  const kind = (mode === 'adv' && sides === 20) ? 'adv'
             : (mode === 'dis' && sides === 20) ? 'dis'
             : '';
  const base = kind ? `${count}×(d${sides} ${kind})` : `${count}d${sides}`;
  if (!mod || mod === 0) return base;
  const sign = mod > 0 ? '+' : '';
  return `${base} ${sign}${mod}`;
}

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

  ensureSocketIO().then((ok) => {
    if (!ok) { logToFeed('❌ Nepodařilo se načíst Socket.IO klienta'); return; }

    socket = io();
    socket.on('connect',       () => logToFeed('✅ Připojeno k serveru (' + socket.id + ')'));
    socket.on('connect_error', (e) => logToFeed('⚠️ connect_error: ' + (e && e.message)));
    socket.on('joined', ({ room, player }) => logToFeed(`✅ Připojeno ke stolu „${room}“ jako ${player}.`));
    socket.on('system', (msg) => logToFeed((msg && msg.text) || 'system'));
    socket.on('dice-result', (res) => {
      addResultItem(res);
      if (window.Dice3D) { try { Dice3D.roll(res.sides, res.rolls); } catch (e) { logToFeed('3D roll chyba: ' + e.message); } }
    });

    // UI handlers až když máme socket
    joinBtn.addEventListener('click', joinRoom);
    playerInput.addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });
    roomInput.addEventListener('keydown',  e => { if (e.key === 'Enter') joinRoom(); });

    shareBtn.addEventListener('click', async () => {
      const url = new URL(location.href);
      url.searchParams.set('room', (roomInput.value || 'stul-1').trim());
      try { await navigator.clipboard.writeText(url.toString()); logToFeed('🔗 Odkaz zkopírován'); }
      catch { logToFeed('⚠️ Nepodařilo se zkopírovat odkaz'); }
    });

    rollBtn.addEventListener('click', () => {
      const sides = parseInt(sidesSelect.value, 10);
      const count = Math.min(10, Math.max(1, parseInt(countInput.value || '1', 10)));
      const modifier = Math.min(99, Math.max(-99, parseInt(modInput.value || '0', 10)));
      socket.emit('roll-dice', { sides, count, modifier });
      logToFeed(`🎯 roll-dice odeslán (${count}d${sides}${modifier? (modifier>0?'+':'')+modifier : ''})`);
    });

    // Auto-join
    // Předvyplň hráče + room z localStorage / URL:
    playerInput.value = localStorage.getItem('playerName') || playerInput.value || '';
    const params = new URLSearchParams(location.search);
    roomInput.value = params.get('room') || roomInput.value || 'stul-1';
    joinRoom();
    logToFeed('▶️ joinRoom() spuštěn (auto)');
  });
});
