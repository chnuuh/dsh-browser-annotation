import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime, visibleGuest, activeSession } from '../src/runtime.js';

const packet = (id='one', sessionId='a') => ({id,sessionId,mode:'quick',items:[{page:'http://localhost/demo',tag:'button',text:'Save'}]});
function setup() {
  let task, id='a', shown=true, result=null, writable=true;
  const scripts=[], inserted=[], states=[];
  const guest={getURL:()=> 'http://localhost/demo',executeJavaScript:async script=>{scripts.push(script);return typeof result==='function'?result(script):result;}};
  const timers={setTimeout(fn){task=fn;return 1;},clearTimeout(){task=null;}};
  const runtime=createRuntime({current:()=>shown?guest:null,session:()=>id,owner:'owner',timers,report:s=>states.push(s)});
  const actions={captureInsertion:()=>({start:1,end:4,draftRev:3}),insertText:(text,span)=>{if(!writable)return false;inserted.push({text,span});return true;}};
  runtime.bind('a',actions);
  return {runtime,guest,actions,scripts,inserted,states,
    run:async()=>{const fn=task;task=null;if(fn)await fn();},
    result:v=>{result=v;},session:v=>{id=v;},hide:()=>{shown=false;},writable:v=>{writable=v;}};
}
test('one receipt per page prevents duplicate insertions and preserves draft revision',async()=>{
  const h=setup();h.result(packet());await h.run();await h.run();
  assert.equal(h.inserted.length,1);assert.deepEqual(h.inserted[0].span,{start:4,end:4,draftRev:3});
  assert.match(h.scripts.at(-1),/"one"/);await h.runtime.dispose();
});
test('busy input retains pending packet until an insertion succeeds',async()=>{
  const h=setup();h.result(packet());h.writable(false);await h.run();assert.equal(h.inserted.length,0);
  h.writable(true);await h.run();assert.equal(h.inserted.length,1);await h.runtime.dispose();
});
test('cross-session packet, unknown mode, oversized batch and late results are not delivered',async()=>{
  const h=setup();h.result(packet('one','other'));await h.run();
  h.result({...packet(),mode:'execute'});await h.run();
  h.result({...packet(),items:Array(21).fill({})});await h.run();
  let resolve;h.result(()=>new Promise(r=>{resolve=r;}));const running=h.run();
  h.session('b');resolve(packet());await running;assert.equal(h.inserted.length,0);await h.runtime.dispose();
});
test('legacy patch and other plugin instance are detected without replacing guest listeners',async()=>{
  const h=setup();h.result({legacy:true});await h.run();assert.equal(h.states.at(-1),'legacy');
  h.result({conflict:true});await h.run();assert.equal(h.states.at(-1),'conflict');
  assert.equal(h.scripts.length,2);assert.equal(h.inserted.length,0);await h.runtime.dispose();
});
test('unmount removes binding; stale cleanup cannot remove a replacement binding',async()=>{
  const h=setup();const off=h.runtime.bind('a',h.actions);h.runtime.bind('a',h.actions);off();
  h.result(packet());await h.run();assert.equal(h.inserted.length,1);
  const offNew=h.runtime.bind('a',h.actions);offNew();h.result(packet('two'));await h.run();assert.equal(h.inserted.length,1);await h.runtime.dispose();
});
test('pause and unload clean up only owned guest code; hidden pages are not polled',async()=>{
  const h=setup();h.result({install:true});await h.run();assert.match(h.scripts[1],/installGuestAnnotations/);
  await h.runtime.setEnabled(false);assert.match(h.scripts.at(-1),/a\?\.owner==="owner"/);assert.match(h.scripts.at(-1),/a.dispose/);
  const before=h.scripts.length;await h.run();assert.equal(h.scripts.length,before);
  await h.runtime.setEnabled(true);h.hide();await h.run();assert.equal(h.scripts.length,before);await h.runtime.dispose();
});
test('unload during asynchronous guest injection cleans up after injection completes',async()=>{
  const h=setup();let resolve;
  h.result(script=>script.includes('function installGuestAnnotations')?new Promise(r=>{resolve=r;}):{install:true});
  const running=h.run();await Promise.resolve();await Promise.resolve();
  assert.ok(resolve);const disposed=h.runtime.dispose();resolve({installed:true});await running;await disposed;
  assert.match(h.scripts.at(-1),/a.dispose/);const before=h.scripts.length;await h.run();assert.equal(h.scripts.length,before);
});
test('visible browser selection rejects ambiguity and hidden surfaces',()=>{
  const one={isConnected:true,executeJavaScript(){},getBoundingClientRect:()=>({width:100,height:100})};
  let rows=[one];const doc={querySelectorAll:()=>rows,defaultView:{getComputedStyle:()=>({display:'flex',visibility:'visible'})}};
  assert.equal(visibleGuest(doc),one);rows=[one,{...one}];assert.equal(visibleGuest(doc),null);
  rows=[{...one,isConnected:false}];assert.equal(visibleGuest(doc),null);
  assert.equal(activeSession({getSnapshot:()=>({byId:{a:{id:'a',retainedBy:{mainView:1}}}})}),'a');
  assert.equal(activeSession({getSnapshot:()=>({byId:{a:{id:'a',retainedBy:{mainView:1}},b:{id:'b',retainedBy:{mainView:1}}}})}),null);
});
