import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { makeIndex } from '../scripts/market-index.mjs';

const root=new URL('../',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,root),'utf8');
test('the shipped composer slot binds draft actions without rendering a control', () => {
  let declaration, component, effect, binding;
  const context = vm.createContext({
    window: { __ModuleLoader__: { load: value => { declaration = value; } } },
    crypto: { randomUUID: () => 'test-owner' }, setTimeout: () => 1, clearTimeout() {}
  });
  vm.runInContext(read('client.js'), context);
  const plugin = declaration.factory(name => {
    assert.equal(name, 'react');
    return { useEffect: callback => { binding = callback; } };
  });
  plugin.apply({
    effect: callback => { effect = callback; },
    slots: {
      inject(name, register) { assert.equal(name, 'conversation.input.right'); register(); },
      register(options, view) { assert.equal(options.id, 'dsh-browser-annotation'); component = view; }
    }
  });
  const dispose = effect();
  const actions = { captureInsertion() {}, insertText() {} };
  assert.equal(component({ sessionId: 'demo', inputActions: actions }), null);
  const unbind = binding();
  unbind();
  return dispose();
});
test('package is standalone, ships generated client and has no install hooks or DS Bot dependency',()=>{
  const meta=JSON.parse(read('package.json'));
  assert.equal(meta.dsh.bundle.patch,'./cordis.patch.yml');assert.equal(meta.exports['./client'],'./client.js');
  for(const hook of ['prepare','install','preinstall','postinstall'])assert.equal(meta.scripts[hook],undefined);
  assert.equal(meta.dependencies,undefined);assert.equal(meta.license,'Apache-2.0');
  assert.match(read('LICENSE'),/Apache License/);
  for(const file of ['index.js','client.js','icon.svg','cordis.patch.yml','locale/zh.json','locale/en.json'])assert.ok(read(file));
  assert.doesNotMatch(read('client.js'),/\/Users\/|base\.client|DS-BOT-PATH-MENU/);
});
test('market entry pins a Git commit and refuses placeholders or unqualified times',()=>{
  const args={repo:'example/dsh-browser-annotation',commit:'a'.repeat(40),publishedAt:'2026-11-15T22:00:00+08:00',version:'0.1.0-alpha.1',icon:read('icon.svg')};
  const index=makeIndex(args);assert.equal(index.format,1);assert.equal(index.plugins[0].versions[0].source.commit,args.commit);
  assert.throws(()=>makeIndex({...args,commit:'main'}));assert.throws(()=>makeIndex({...args,commit:'0'.repeat(40)}));
  assert.throws(()=>makeIndex({...args,publishedAt:'2026-11-15'}));assert.throws(()=>makeIndex({...args,repo:'https://example.com'}));
});
