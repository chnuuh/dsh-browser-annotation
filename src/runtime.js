import { installGuestAnnotations, insertAnnotationDraft } from './annotation.js';

// Only the two inspected Electron webview surfaces. Native BrowserViews and
// iframe pages require separate adapters; do not guess at their private state.
export function visibleGuest(doc) {
  const guests = [...doc.querySelectorAll('webview[data-sidebar-browser-frame="webview"], webview[data-bt-browser]')]
    .filter(element => {
      if (!element.isConnected || typeof element.executeJavaScript !== 'function') return false;
      const box = element.getBoundingClientRect();
      const style = doc.defaultView.getComputedStyle(element);
      return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    });
  return guests.length === 1 ? guests[0] : null;
}

export function activeSession(source) {
  const rows = Object.values(source.getSnapshot().byId ?? {})
    .filter(row => (row?.retainedBy?.mainView ?? 0) > 0);
  return rows.length === 1 ? rows[0].id : null;
}

export function createRuntime({ current, session, owner, timers = globalThis, report = () => {} }) {
  const key = '__dshBrowserAnnotationV1';
  const bindings = new Map();
  const touched = new Set();
  const receipts = new WeakMap();
  let stopped = false, timer, busy = null, status;
  const emit = value => { if (value !== status) { status = value; report(value); } };
  const disposeGuest = async guest => {
    try {
      await guest.executeJavaScript(`(()=>{const a=globalThis[${JSON.stringify(key)}];if(a?.owner===${JSON.stringify(owner)})a.dispose();})()`);
    } catch { /* A closed or navigated guest no longer owns our listeners. */ }
  };
  const clearGuests = async () => {
    const guests = [...touched]; touched.clear();
    await Promise.all(guests.map(disposeGuest));
  };
  const stillCurrent = (guest, id, url, binding) => !stopped && current() === guest &&
    session() === id && guest.getURL() === url && bindings.get(id) === binding;

  async function step() {
    if (stopped) return;
    const id = session();
    const binding = bindings.get(id);
    if (!id || !binding) { emit('no-composer'); return; }
    const guest = current();
    if (!guest) { emit('no-browser'); return; }
    const url = guest.getURL();
    if (!/^https?:\/\//i.test(url)) { emit('no-browser'); return; }
    const receipt = receipts.get(guest);
    const ack = receipt?.url === url && receipt.sessionId === id ? receipt.id : null;
    const result = await guest.executeJavaScript(`(()=>{
      if(globalThis.__dsBotAnnotationV1)return {legacy:true};
      const a=globalThis[${JSON.stringify(key)}];
      if(!a)return {install:true};
      if(a.version!==1||a.owner!==${JSON.stringify(owner)})return {conflict:true};
      return a.poll(${JSON.stringify(id)},${JSON.stringify(ack)});
    })()`);
    if (!stillCurrent(guest, id, url, binding)) return;
    if (result?.legacy) { emit('legacy'); return; }
    if (result?.conflict) { emit('conflict'); return; }
    if (result?.install) {
      touched.add(guest);
      const installed = await guest.executeJavaScript(`(${installGuestAnnotations.toString()})(${JSON.stringify(id)},${JSON.stringify(owner)})`);
      if (stopped) { await disposeGuest(guest); return; }
      if (installed?.legacy || installed?.conflict) { emit(installed.legacy ? 'legacy' : 'conflict'); return; }
      if (!stillCurrent(guest, id, url, binding)) return;
      emit('ready'); return;
    }
    if (result?.blocked) { emit('other-session'); return; }
    if (!result) { emit('ready'); return; }
    if (result.sessionId !== id) { emit('other-session'); return; }
    if (ack === result.id) { emit('ready'); return; }
    if (insertAnnotationDraft(binding.inputActions, result)) {
      receipts.set(guest, { id: result.id, url, sessionId: id });
      emit('inserted');
    } else emit('busy'); // Keep the payload queued until the input becomes writable.
  }

  async function tick() {
    if (stopped || busy) return;
    busy = step().catch(() => emit('error'));
    try { await busy; } finally {
      busy = null;
      if (!stopped) timer = timers.setTimeout(tick, 650);
    }
  }
  timer = timers.setTimeout(tick, 0);
  return {
    bind(id, inputActions) {
      if (!id || typeof inputActions?.captureInsertion !== 'function' || typeof inputActions?.insertText !== 'function') return () => {};
      const binding = { inputActions }; bindings.set(id, binding);
      return () => { if (bindings.get(id) === binding) bindings.delete(id); };
    },
    async dispose() {
      stopped = true; timers.clearTimeout(timer);
      if (busy) await busy;
      bindings.clear(); await clearGuests();
    }
  };
}
