/* SJO Games — Supabase sync layer
   Requires login on every page. Keeps localStorage as the instant, offline
   source of truth (unchanged), and mirrors each finished game to Supabase
   in the background via the record_game_result() RPC. If the request fails
   (offline, etc.) it's queued in localStorage and retried automatically.
*/
(function () {
  'use strict';

  // ---- Fill these in from your Supabase project settings (Project Settings → API) ----
  const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
  const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";
  // --------------------------------------------------------------------------------

  const QUEUE_KEY = 'sjo_sync_queue';
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.SJO_SB = sb; // exposed in case a page wants the raw client (e.g. leaderboard page)

  function currentFile() {
    return location.pathname.split('/').pop() || 'index.html';
  }

  async function requireSession() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      const redirect = encodeURIComponent(currentFile());
      window.location.href = 'auth.html?redirect=' + redirect;
      return null;
    }
    return session;
  }

  function loadQueue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveQueue(q) { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }
  function enqueue(item) { const q = loadQueue(); q.push(item); saveQueue(q); }

  async function pushResult(game, result, score) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { enqueue({ game, result, score }); return; }
    const { error } = await sb.rpc('record_game_result', { p_game: game, p_result: result, p_score: score | 0 });
    if (error) enqueue({ game, result, score });
  }

  async function flushQueue() {
    const q = loadQueue();
    if (!q.length) return;
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    const remaining = [];
    for (const item of q) {
      const { error } = await sb.rpc('record_game_result', {
        p_game: item.game, p_result: item.result, p_score: item.score | 0
      });
      if (error) remaining.push(item);
    }
    saveQueue(remaining);
  }

  window.addEventListener('online', flushQueue);

  // Hook into the existing V9 recorder — every game already calls
  // window.SJOGamesV9.record(game, result, score) at the real end of a match,
  // so this is the one place that needs to change to also sync to Supabase.
  function wrapV9() {
    if (!window.SJOGamesV9 || window.SJOGamesV9.__sbWrapped) return false;
    const original = window.SJOGamesV9.record.bind(window.SJOGamesV9);
    window.SJOGamesV9.record = function (game, result, score) {
      const ret = original(game, result, score);
      pushResult(game, result, score);
      return ret;
    };
    window.SJOGamesV9.__sbWrapped = true;
    return true;
  }

  (async function init() {
    const session = await requireSession();
    if (!session) return; // already redirecting to auth.html

    // sjo-v9-advanced-offline.js loads just before this script, but guard
    // in case load order ever changes.
    if (!wrapV9()) {
      let tries = 0;
      const iv = setInterval(() => {
        tries++;
        if (wrapV9() || tries > 50) clearInterval(iv);
      }, 50);
    }

    flushQueue();

    // Simple sign-out helper any page can call, e.g. from a "Log out" button.
    window.SJO_SIGNOUT = async function () {
      await sb.auth.signOut();
      window.location.href = 'auth.html';
    };
  })();
})();
