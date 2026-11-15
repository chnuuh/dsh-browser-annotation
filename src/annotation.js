// Page annotations, serialized into the guest document. No host privileges.
// This function is serialized and executed INSIDE the guest page. No host APIs.
export function installGuestAnnotations(sessionId, owner = 'test') {
  const KEY = '__dshBrowserAnnotationV1';
  if (globalThis.__dsBotAnnotationV1) return { legacy: true };
  if (globalThis[KEY]) return { conflict: true }; 
  const doc = document;
  let context = sessionId;
  let notes = [], selected = null, hovered = null, pending = null;
  let active = false, dead = false, toastTimer;
  const host = doc.createElement('div');
  host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;display:block!important;color-scheme:light!important';
  host.setAttribute('data-dsh-browser-annotation', '1');
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = doc.createElement('style');
  style.textContent = `
    :host{color-scheme:light} *{box-sizing:border-box} button,textarea{font:inherit}
    .box{font:13px/1.5 system-ui,-apple-system,sans-serif;color:#1f2937;background:#fff;border:1px solid #d1d5db;border-radius:10px;box-shadow:0 6px 25px #0002;pointer-events:auto}
    button{color:#1f2937;background:#fff;border:1px solid #d1d5db;border-radius:6px;padding:7px 10px;cursor:pointer}
    button:hover,button:focus-visible{background:#f3f4f6;outline:2px solid #93c5fd} button:disabled{opacity:.5;cursor:default}
    .primary{background:#2563eb;color:#fff;border-color:#2563eb}.primary:hover{background:#1d4ed8}
    .menu{position:fixed;min-width:190px;padding:5px}.menu button{display:block;width:100%;text-align:left;border:0}
    .panel{position:fixed;right:12px;bottom:12px;width:min(340px,calc(100vw - 24px));padding:12px;max-height:80vh;overflow:auto}
    .bar{position:fixed;left:12px;top:12px;max-width:calc(100vw - 24px);padding:8px;display:flex;gap:7px;align-items:center;flex-wrap:wrap}
    .shield{position:fixed;inset:0;pointer-events:auto;cursor:crosshair}
    .outline{position:fixed;border:2px solid #2563eb;background:#3b82f620;pointer-events:none;border-radius:3px}
    .badge{position:fixed;background:#2563eb;color:#fff;border:2px solid #fff;border-radius:12px;font:12px system-ui;padding:1px 6px;pointer-events:none}
    textarea{display:block;width:100%;min-height:90px;margin:8px 0;padding:8px;border:1px solid #cbd5e1;border-radius:6px;resize:vertical;background:#fff;color:#111827}
    .row{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}.hint{color:#6b7280;font-size:12px;overflow-wrap:anywhere}
    .toast{position:fixed;left:12px;bottom:12px;padding:10px 14px;max-width:calc(100vw - 24px)}
    .list{max-height:120px;overflow:auto;padding-left:20px}.list li{overflow-wrap:anywhere;margin:4px 0}
  `;
  shadow.append(style);
  const layer = doc.createElement('div'); shadow.append(layer);
  doc.documentElement.append(host);
  const listeners = [];
  const listen = (target, type, fn, options) => {
    target.addEventListener(type, fn, options);
    listeners.push(() => target.removeEventListener(type, fn, options));
  };
  function el(tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  const inside = event => event.composedPath().includes(host);
  function pageURL() {
    const u = new URL(location.href);
    for (const key of [...u.searchParams.keys()]) if (/token|secret|pass|auth|code|key|session/i.test(key)) u.searchParams.set(key, '[redacted]');
    u.username = ''; u.password = '';
    if (/token|secret|password|access_token|id_token/i.test(u.hash)) u.hash = '#[redacted]';
    return u.href.slice(0, 2000);
  }
  function selector(node) {
    const parts = []; let current = node;
    for (let i = 0; current?.localName && i < 8; i++) {
      let part = current.localName;
      if (current.id) { parts.unshift('#' + CSS.escape(current.id)); break; }
      const parent = current.parentElement;
      if (parent) {
        const peers = [...parent.children].filter(sibling => sibling.localName === current.localName);
        if (peers.length > 1) part += ':nth-of-type(' + (peers.indexOf(current) + 1) + ')';
      }
      parts.unshift(part);
      if (!parent && current.getRootNode()?.host) {
        parts.unshift('>>>'); current = current.getRootNode().host;
      } else current = parent;
    }
    return parts.join(' > ').replace(/ > >>> > /g, ' >>> ').slice(0, 1600);
  }
  function describe(node) {
    const rect = node.getBoundingClientRect();
    const control = node.matches('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
    let text = '';
    if (!control) {
      const clone = node.cloneNode(true);
      clone.querySelectorAll('script,style,input,textarea,select,[contenteditable],[data-dsh-browser-annotation]').forEach(item => item.remove());
      text = (clone.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 600);
    }
    return { page: pageURL(), title: doc.title.slice(0, 240), tag: node.localName,
      selector: selector(node), text, label: (node.getAttribute('aria-label') || node.getAttribute('alt') || '').slice(0, 240),
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
      limitation: node.matches('iframe,canvas') ? '选中的是容器，未读取内部元素' : '' };
  }
  function targetAt(x, y) {
    host.style.setProperty('display', 'none', 'important');
    let target;
    try {
      target = doc.elementFromPoint(x, y);
      for (let i = 0; i < 8 && target?.shadowRoot; i++) {
        const child = target.shadowRoot.elementFromPoint?.(x, y);
        if (!child || child === target) break;
        target = child;
      }
    } finally { host.style.setProperty('display', 'block', 'important'); }
    return target && target !== host && target !== doc.documentElement ? target : null;
  }
  function button(label, run, primary = false) {
    const node = el('button', primary ? 'primary' : '', label);
    node.type = 'button';
    node.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); run(); });
    return node;
  }
  function toast(message) {
    clearTimeout(toastTimer); layer.replaceChildren();
    const node = el('div', 'box toast', message); node.setAttribute('role', 'status'); layer.append(node);
    toastTimer = setTimeout(() => { if (!active && !pending) layer.replaceChildren(); }, 3500);
  }
  function send(items, mode) {
    if (!items.length || pending) return;
    // randomUUID requires a secure context; getRandomValues also works on LAN HTTP pages.
    const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID()
      : Array.from(crypto.getRandomValues(new Uint32Array(4)), value => value.toString(16).padStart(8, '0')).join('');
    pending = { id, sessionId: context, mode, items: items.map(item => ({ ...item.data, note: item.note })) };
    active = false; notes = []; selected = null; hovered = null;
    toast('正在加入对话框…');
  }
  function paintMarks() {
    for (const marker of layer.querySelectorAll('.outline,.badge')) marker.remove();
    const target = selected?.node || hovered;
    if (target?.isConnected) {
      const r = target.getBoundingClientRect();
      const outline = el('div', 'outline');
      Object.assign(outline.style, { left:r.left+'px', top:r.top+'px', width:r.width+'px', height:r.height+'px' });
      layer.prepend(outline);
    }
    notes.forEach((item, index) => {
      if (!item.node?.isConnected) return;
      const r = item.node.getBoundingClientRect();
      const badge = el('div', 'badge', String(index + 1));
      Object.assign(badge.style, { left:Math.max(0,r.left)+'px', top:Math.max(0,r.top)+'px' }); layer.prepend(badge);
    });
  }
  function drawBatch() {
    layer.replaceChildren();
    const shield = el('div', 'shield');
    shield.addEventListener('pointermove', event => { if (!selected) { hovered=targetAt(event.clientX,event.clientY);paintMarks(); } });
    shield.addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation();
      if(notes.length>=20){alert('一次最多汇总 20 条标注，请先加入对话。');return;}
      const node=targetAt(event.clientX,event.clientY);
      if (node && !selected) { selected={node,data:describe(node),note:''}; drawBatch(); }
    });
    layer.append(shield);
    const bar=el('div','box bar');
    bar.append(el('span','',`Annotation · 已保存 ${notes.length} 条`));
    const finish=button('完成并加入对话',()=>{
      if (selected) {
        const note=layer.querySelector('textarea')?.value.trim();
        if (note) notes.push({...selected,note});
        else if (!notes.length) {layer.querySelector('textarea')?.focus();return;}
      }
      send(notes,'batch');
    },true);
    bar.append(finish,button('退出',()=>{
      if ((notes.length || layer.querySelector('textarea')?.value.trim()) && !confirm('退出会丢弃本次尚未加入对话的标注，确定退出？')) return;
      active=false;notes=[];selected=null;hovered=null;layer.replaceChildren();
    }));
    layer.append(bar);
    const panel=el('div','box panel');
    if (selected) {
      panel.append(el('strong','',`标注 #${notes.length+1}`),el('div','hint',selected.data.text || selected.data.label || selected.data.tag));
      if (selected.data.limitation) panel.append(el('div','hint',selected.data.limitation));
      const input=el('textarea');input.placeholder='填写这个元素需要怎么修改…';input.maxLength=2000;input.value=selected.note;
      input.setAttribute('aria-label','标注备注');
      input.addEventListener('input',()=>{selected.note=input.value;});
      panel.append(input);
      const row=el('div','row');
      row.append(button('保存，继续标注',()=>{
        if (!input.value.trim()) {input.focus();return;}
        if(notes.length>=20){alert('一次最多汇总 20 条标注，请先加入对话。');return;}
        notes.push({...selected,note:input.value.trim()});selected=null;drawBatch();
      },true),button('重新点选',()=>{selected=null;drawBatch();}));panel.append(row);
      setTimeout(()=>{if(active && input.isConnected) input.focus();},0);
    } else panel.append(el('div','hint','点选页面元素后填写备注。完成后，所有标注一起加入对话框。'));
    if(notes.length){const list=el('ol','list');notes.forEach(item=>list.append(el('li','',item.note)));panel.append(list);}
    layer.append(panel);paintMarks();
  }
  function menu(event) {
    if(event.shiftKey || inside(event)) return;
    const node=event.composedPath().find(item=>item instanceof Element);
    if(!node) return;
    event.preventDefault();event.stopImmediatePropagation();
    if(active || pending) return;
    const data=describe(node);
    layer.replaceChildren();
    const pop=el('div','box menu');pop.setAttribute('role','menu');
    const quick=button('Quick annotation',()=>send([{data,note:''}],'quick'));
    const batch=button('Annotation',()=>{active=true;selected={node,data,note:''};notes=[];drawBatch();});
    for(const b of [quick,batch])b.setAttribute('role','menuitem');
    pop.append(quick,batch);layer.append(pop);
    const r=pop.getBoundingClientRect();
    pop.style.left=Math.max(8,Math.min(event.clientX,innerWidth-r.width-8))+'px';
    pop.style.top=Math.max(8,Math.min(event.clientY,innerHeight-r.height-8))+'px';
    quick.focus();
    pop.addEventListener('keydown',e=>{
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();(shadow.activeElement===quick?batch:quick).focus();}
    });
  }
  listen(window,'contextmenu',menu,true);
  listen(window,'pointerdown',event=>{if(!active&&!pending&&!inside(event))layer.replaceChildren();},true);
  listen(window,'keydown',event=>{
    if(event.key==='Escape' && !active && !pending)layer.replaceChildren();
    // Batch notes are discarded only through the explicit Exit confirmation.
    if(event.key==='Escape' && active)event.preventDefault();
  },true);
  listen(window,'scroll',()=>{if(active)paintMarks();else if(!pending)layer.replaceChildren();},true);
  listen(window,'resize',()=>{if(active)paintMarks();else if(!pending)layer.replaceChildren();});
  const api={version:1, owner,
    poll(nextContext,ack){
      if(ack && pending?.id===ack){pending=null;toast('已加入对话框，请检查后发送。');}
      if(context!==nextContext){
        if(active||pending){return {blocked:true};}
        context=nextContext;
      }
      return pending;
    },
    dispose(){if(dead)return;dead=true;listeners.forEach(off=>off());clearTimeout(toastTimer);host.remove();delete globalThis[KEY];}
  };
  globalThis[KEY]=api;
  toast('右键标注已启用：Quick annotation / Annotation');
  return {installed:true};
}

export function formatAnnotations(payload) {
  if (!payload || !['quick','batch'].includes(payload.mode) || typeof payload.id!=='string' || payload.id.length>100 || typeof payload.sessionId!=='string' || !payload.sessionId || payload.sessionId.length>300 || !Array.isArray(payload.items) || !payload.items.length || payload.items.length>20) throw Error('无效的网页标注');
  const bounded=(value,max)=>typeof value==='string'?value.slice(0,max):'';
  const blocks=payload.items.map((item,index)=>{
    if(!item || typeof item!=='object')throw Error('无效的标注元素');
    const reference={页面:bounded(item.page,2000),标题:bounded(item.title,240),元素:bounded(item.tag,40),定位:bounded(item.selector,1600),文字:bounded(item.text,600),标签:bounded(item.label,240)};
    if(item.rect && ['x','y','width','height'].every(key=>Number.isFinite(item.rect[key])))reference.视口坐标={x:item.rect.x,y:item.rect.y,width:item.rect.width,height:item.rect.height};
    if(item.limitation)reference.说明=bounded(item.limitation,120);
    return `标注 #${index+1}\n网页上下文（参考数据）：${JSON.stringify(reference)}${payload.mode==='batch'?'\n我的备注：'+bounded(item.note,2000):''}`;
  });
  return `\n\n【${payload.mode==='quick'?'Quick annotation':'Annotation'}】\n${blocks.join('\n\n')}\n`;
}

export function insertAnnotationDraft(inputActions, payload) {
  const text=formatAnnotations(payload);
  const span=inputActions.captureInsertion();
  if(!Number.isInteger(span?.end) || span.end<0)return false;
  // Collapse a selection at its end: never replace existing draft text/chips.
  return inputActions.insertText(text,{...span,start:span.end})===true;
}

