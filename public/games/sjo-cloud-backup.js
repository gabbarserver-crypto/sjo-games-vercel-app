/* SJO Games — automatic cloud backup & restore
   Replaces the manual Backup / Restore buttons.

   - Every time a game/profile value changes in localStorage it is uploaded to
     Supabase (table public.sjo_games_backups, one row per signed-in account).
   - On page load (after login) the cloud copy is compared with this device:
       * new device / empty device  -> cloud data is restored automatically
       * this device has newer data -> it is uploaded
   - Works the same for Google and email/password logins, because the backup
     is keyed to the Supabase user id.
   Load this AFTER sjo-supabase-sync.js (it needs window.SJO_SB).
*/
(function () {
  'use strict';

  var TABLE   = 'sjo_games_backups';
  var META    = 'sjo_cloud_meta';          // device-local bookkeeping, never uploaded
  var INCLUDE = /^(sjo|ttt_)/;             // sjo_v4_data, sjo_games_v8/v9, sjoBest_*, ttt_* ...
  var EXCLUDE = /^(sjo_sync_queue|sjo_cloud_meta)$/;
  var DEBOUNCE_MS = 3000;

  var SUPABASE_URL = "https://kxusesmymrlbjsbppikm.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_T8sMx32GuOd8V5tvtb3gPg_RQHhrQ1h";

  var sb = window.SJO_SB;
  if (!sb) return;

  var rawSet = Storage.prototype.setItem;
  var rawRemove = Storage.prototype.removeItem;

  var session = null;
  var frozen = false;       // true right after a restore, until the page reloads
  var pushTimer = null;
  var pushing = false;
  var statusEl = null;

  function wanted(k) { return typeof k === 'string' && INCLUDE.test(k) && !EXCLUDE.test(k); }

  /* ---------- device-local meta ---------- */
  function getMeta() {
    try { return JSON.parse(localStorage.getItem(META) || '{}') || {}; } catch (e) { return {}; }
  }
  function setMeta(patch) {
    var m = getMeta();
    Object.keys(patch).forEach(function (k) { m[k] = patch[k]; });
    try { rawSet.call(localStorage, META, JSON.stringify(m)); } catch (e) {}
    return m;
  }

  /* ---------- snapshot / apply ---------- */
  function snapshot() {
    var out = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (wanted(k)) out[k] = localStorage.getItem(k);
    }
    return out;
  }

  function progressScore(keys) {
    // crude "how much progress" measure, only used when BOTH sides have data
    // and this device has never synced before (first login on a used device)
    var total = 0;
    function walk(v) {
      if (typeof v === 'number' && isFinite(v)) total += Math.abs(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { walk(v[k]); });
    }
    Object.keys(keys || {}).forEach(function (k) {
      if (!/^sjo_(v4_data|games_v)/.test(k)) return;
      try { walk(JSON.parse(keys[k])); } catch (e) {}
    });
    return total;
  }

  function clearLocalGameData() {
    var rm = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (wanted(k)) rm.push(k);
    }
    rm.forEach(function (k) { rawRemove.call(localStorage, k); });
  }

  function applyRemote(row) {
    var remote = (row.data && row.data.keys) || {};
    clearLocalGameData();
    Object.keys(remote).forEach(function (k) {
      if (wanted(k)) rawSet.call(localStorage, k, remote[k]);
    });
    setMeta({
      user: session.user.id,
      syncedAt: Date.now(),
      remoteAt: row.updated_at,
      changedAt: (row.data && row.data.savedAt) || Date.now(),
      dirty: false
    });
    frozen = true;            // stop the old in-memory page from overwriting what we just restored
    status('restored', 'Restoring your saved progress…');
    location.reload();
  }

  /* ---------- upload ---------- */
  function buildRow() {
    var m = getMeta();
    return {
      user_id: session.user.id,
      data: { keys: snapshot(), savedAt: m.changedAt || Date.now() },
      updated_at: new Date().toISOString()
    };
  }

  async function push() {
    if (!session || pushing || frozen) return;
    pushing = true;
    status('syncing');
    try {
      var row = buildRow();
      var res = await sb.from(TABLE).upsert(row, { onConflict: 'user_id' });
      if (res.error) throw res.error;
      setMeta({ user: session.user.id, syncedAt: Date.now(), remoteAt: row.updated_at, dirty: false });
      status('ok');
    } catch (e) {
      setMeta({ dirty: true });
      status('error');
    } finally {
      pushing = false;
    }
  }

  // Best-effort upload while the tab is being closed / hidden
  function pushOnLeave() {
    if (!session || frozen) return;
    var m = getMeta();
    if (!m.dirty) return;
    try {
      var row = buildRow();
      fetch(SUPABASE_URL + '/rest/v1/' + TABLE + '?on_conflict=user_id', {
        method: 'POST',
        keepalive: true,
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + session.access_token,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(row)
      });
      setMeta({ remoteAt: row.updated_at, syncedAt: Date.now(), dirty: false });
    } catch (e) {}
  }

  function schedulePush() {
    if (!session || frozen) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, DEBOUNCE_MS);
  }

  /* ---------- watch localStorage writes ---------- */
  function markChanged(k) {
    if (!wanted(k)) return;
    setMeta({ changedAt: Date.now(), dirty: true });
    schedulePush();
  }
  Storage.prototype.setItem = function (k, v) {
    if (this === localStorage && frozen && wanted(k)) return;       // ignore writes while restoring
    rawSet.apply(this, arguments);
    if (this === localStorage) markChanged(k);
  };
  Storage.prototype.removeItem = function (k) {
    if (this === localStorage && frozen && wanted(k)) return;
    rawRemove.apply(this, arguments);
    if (this === localStorage) markChanged(k);
  };

  /* ---------- decide: restore or upload ---------- */
  async function sync(allowRestore) {
    if (!session) return;
    status('syncing');
    var res = await sb.from(TABLE).select('data,updated_at').eq('user_id', session.user.id).maybeSingle();
    if (res.error) { status('error'); return; }

    var row = res.data;
    var m = getMeta();
    var local = snapshot();
    var hasLocal = Object.keys(local).length > 0;
    var foreign = m.user && m.user !== session.user.id;     // another account used this browser before

    if (foreign) {
      // never leak one account's progress into another
      clearLocalGameData();
      setMeta({ user: null, syncedAt: 0, remoteAt: null, changedAt: 0, dirty: false });
      m = getMeta(); local = {}; hasLocal = false;
      if (!row) { status('ok'); return; }
    }

    if (!row) {                                   // first backup for this account
      if (hasLocal) await push(); else status('ok');
      return;
    }

    var remoteKeys = (row.data && row.data.keys) || {};
    var remoteSavedAt = (row.data && row.data.savedAt) || 0;
    var remoteChanged = !m.remoteAt || Date.parse(m.remoteAt) !== Date.parse(row.updated_at);

    if (!hasLocal) {                              // new / empty device -> restore
      if (allowRestore) applyRemote(row); else status('ok');
      return;
    }

    if (!m.syncedAt || m.user !== session.user.id) {
      // this device has local progress but has never synced with this account:
      // keep whichever side has made more progress
      if (progressScore(remoteKeys) > progressScore(local)) {
        if (allowRestore) applyRemote(row); else status('ok');
      } else {
        await push();
      }
      return;
    }

    if (!remoteChanged) {                         // cloud unchanged since our last sync
      if (m.dirty) await push(); else status('ok');
      return;
    }

    // cloud changed (e.g. played on another device)
    if (m.dirty && (m.changedAt || 0) > remoteSavedAt) { await push(); return; }   // our edit is newer
    if (allowRestore) applyRemote(row); else status('ok');
  }

  /* ---------- tiny status pill (index page only) ---------- */
  function onIndex() { return /\/(index\.html)?$/.test(location.pathname); }

  function injectUi() {
    var st = document.createElement('style');
    st.textContent =
      '#sjo-manual-backup-hide,#exportBtn,#importBtn,#v8backup,#v8restore,#v9backup,#v9restore{display:none!important}' +
      '#sjoCloud{display:flex;align-items:center;gap:8px;margin:0 0 13px;padding:10px 13px;border-radius:14px;' +
      'background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;font:700 11px system-ui,sans-serif;cursor:pointer}' +
      '#sjoCloud.err{background:#fef2f2;border-color:#fecaca;color:#991b1b}' +
      '#sjoCloud.busy{background:#eef5ff;border-color:#cfe0ff;color:#1e3a8a}' +
      '.dark #sjoCloud{filter:brightness(.92)}';
    document.head.appendChild(st);
    if (!onIndex()) return;
    statusEl = document.createElement('div');
    statusEl.id = 'sjoCloud';
    statusEl.title = 'Tap to sync now';
    statusEl.onclick = function () { push(); };
    var side = document.getElementById('side');
    if (side) side.insertBefore(statusEl, side.firstChild);
    else document.body.insertBefore(statusEl, document.body.firstChild);
    status('syncing');
  }

  function status(kind, text) {
    if (!statusEl) return;
    statusEl.className = kind === 'error' ? 'err' : (kind === 'syncing' || kind === 'restored' ? 'busy' : '');
    if (text) { statusEl.textContent = '☁️ ' + text; return; }
    if (kind === 'syncing') statusEl.textContent = '☁️ Syncing your progress…';
    else if (kind === 'error') statusEl.textContent = '☁️ Backup pending — will retry when online';
    else {
      var t = new Date();
      statusEl.textContent = '☁️ Auto backup ON • synced ' +
        t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }

  /* ---------- start ---------- */
  async function init() {
    var s = await sb.auth.getSession();
    session = s && s.data && s.data.session;
    if (!session) return;                          // sjo-supabase-sync.js sends them to auth.html
    sb.auth.onAuthStateChange(function (_e, ns) { if (ns) session = ns; });

    try { await sync(true); } catch (e) { status('error'); }

    window.addEventListener('online', function () { sync(false); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') pushOnLeave();
      else sync(false);                            // later syncs never reload the page mid-game
    });
    window.addEventListener('pagehide', pushOnLeave);
    window.SJOCloud = { syncNow: function () { return push(); }, pull: function () { return sync(true); } };
  }

  // the sidebar (#side) must exist before we place the pill
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { injectUi(); init(); });
  } else { injectUi(); init(); }
})();
