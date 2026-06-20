/* ============ NEONDROP — persistent state ============ */
window.STATE = (function () {
  const KEY = 'neondrop_save_v2';
  const START_BALANCE = 10000;

  const def = {
    balance: START_BALANCE,
    inventory: [],          // { uid, id, name, weapon, skin, rarity, color, image, wear, price, ts }
    lastBonus: 0,
    stats: { opened: 0, upgrades: 0, bestDrop: 0, contracts: 0 },
  };

  let data = load();
  const listeners = {};

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(def);
      const parsed = JSON.parse(raw);
      return Object.assign(structuredClone(def), parsed);
    } catch (e) {
      return structuredClone(def);
    }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
  }

  function on(evt, cb) { (listeners[evt] = listeners[evt] || []).push(cb); }
  function emit(evt, payload) { (listeners[evt] || []).forEach((cb) => cb(payload)); }

  // ---- balance ----
  function getBalance() { return data.balance; }
  function canAfford(n) { return data.balance >= n; }
  function addBalance(n) {
    data.balance = Math.max(0, Math.round((data.balance + n) * 100) / 100);
    save(); emit('balance', data.balance);
  }
  function setBalance(n) { data.balance = Math.max(0, Math.round(n)); save(); emit('balance', data.balance); }

  // ---- inventory ----
  function getInventory() { return data.inventory; }
  function addItem(item) {
    const uid = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const entry = Object.assign({ uid, ts: Date.now() }, item);
    data.inventory.push(entry);
    if (item.price > data.stats.bestDrop) data.stats.bestDrop = item.price;
    save(); emit('inventory', data.inventory);
    return entry;
  }
  function removeItem(uid) {
    const idx = data.inventory.findIndex((i) => i.uid === uid);
    if (idx === -1) return null;
    const [removed] = data.inventory.splice(idx, 1);
    save(); emit('inventory', data.inventory);
    return removed;
  }
  function removeMany(uids) {
    const set = new Set(uids);
    const removed = data.inventory.filter((i) => set.has(i.uid));
    data.inventory = data.inventory.filter((i) => !set.has(i.uid));
    save(); emit('inventory', data.inventory);
    return removed;
  }
  function findItem(uid) { return data.inventory.find((i) => i.uid === uid); }
  function clearInventory() { data.inventory = []; save(); emit('inventory', data.inventory); }

  // ---- stats / bonus ----
  function bumpStat(key, by = 1) { data.stats[key] = (data.stats[key] || 0) + by; save(); }
  function getStats() { return data.stats; }
  function canClaimBonus() { return Date.now() - data.lastBonus > 8 * 60 * 60 * 1000; }
  function nextBonusIn() { return Math.max(0, 8 * 60 * 60 * 1000 - (Date.now() - data.lastBonus)); }
  function claimBonus(amount) { data.lastBonus = Date.now(); addBalance(amount); save(); }

  return {
    on, emit,
    getBalance, canAfford, addBalance, setBalance,
    getInventory, addItem, removeItem, removeMany, findItem, clearInventory,
    bumpStat, getStats, canClaimBonus, nextBonusIn, claimBonus,
    START_BALANCE,
  };
})();
