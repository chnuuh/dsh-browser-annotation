import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { installGuestAnnotations, formatAnnotations, insertAnnotationDraft } from '../src/annotation.js';

const packet=(id='one',sessionId='session-A')=>({id,sessionId,mode:'quick',items:[{page:'http://localhost:5173/devices',title:'设备管理',tag:'button',selector:'#save',text:'保存',note:''}]});
test('formats quick references and batch notes as text without treating DOM markup as HTML',()=>{
  const p=packet();assert.match(formatAnnotations(p),/Quick annotation/);
  p.mode='batch';p.items.push({...p.items[0],note:'改成蓝色'});p.items[0].text='<script>bad()</script>';p.items[0].note='移动到右侧';
  const s=formatAnnotations(p);assert.match(s,/标注 #2/);assert.match(s,/我的备注：移动到右侧/);assert.match(s,/网页上下文（参考数据）/);
  assert.throws(()=>formatAnnotations({...p,items:Array(21).fill(p.items[0])}));
  assert.throws(()=>formatAnnotations({...p,mode:'execute'}));
});
test('insertion collapses selections and retains revision; it never submits or overwrites a draft',()=>{
  let passed,submitted=false;
  const api={captureInsertion:()=>({start:1,end:4,draftRev:9}),insertText:(text,span)=>{passed={text,span};return true;},submit:()=>{submitted=true;},setDraft:()=>assert.fail('must not replace draft')};
  assert.equal(insertAnnotationDraft(api,packet()),true);
  assert.deepEqual(passed.span,{start:4,end:4,draftRev:9});assert.equal(submitted,false);
  api.insertText=()=>false;assert.equal(insertAnnotationDraft(api,packet()),false);
});

class Events {
  events=new Map();
  addEventListener(type,fn){const list=this.events.get(type)||[];list.push(fn);this.events.set(type,list);}
  removeEventListener(type,fn){this.events.set(type,(this.events.get(type)||[]).filter(f=>f!==fn));}
  emit(type,extra={}){const event={preventDefault(){this.prevented=true;},stopPropagation(){},stopImmediatePropagation(){this.stopped=true;},...extra};for(const fn of this.events.get(type)||[])fn(event);return event;}
}
class Node extends Events {
  children=[];attrs={};style={setProperty(name,value){this[name]=value;}};className='';ownText='';value='';
  constructor(tag,doc){super();this.localName=tag;this.doc=doc;}
  setAttribute(name,value){this.attrs[name]=value;if(name==='id')this.id=value;}
  getAttribute(name){return this.attrs[name]??null;}
  get textContent(){return this.ownText+this.children.map(c=>c.textContent).join('');}
  set textContent(value){this.ownText=String(value);this.children=[];}
  append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
  prepend(node){node.parentElement=this;this.children.unshift(node);}
  replaceChildren(...nodes){for(const node of this.children)node.parentElement=null;this.children=[];this.ownText='';this.append(...nodes);}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(c=>c!==this);this.parentElement=null;}
  get isConnected(){return this===this.doc.documentElement||!!this.parentElement?.isConnected||!!this.host?.isConnected;}
  getRootNode(){return this.parentElement?.getRootNode()||this;}
  attachShadow(){const root=new Node('shadow',this.doc);root.host=this;this.shadowForTest=root;return root;}
  focus(){this.doc.activeElement=this;const root=this.getRootNode();root.activeElement=this;}
  getBoundingClientRect(){return {x:20,y:40,left:20,top:40,right:140,bottom:70,width:120,height:30};}
  matches(query){return query.split(',').some(sel=>{
    if(sel.startsWith('.'))return this.className.split(' ').includes(sel.slice(1));
    if(sel.startsWith('[data-'))return this.getAttribute(sel.slice(1,-1))!==null;
    if(sel.startsWith('[contenteditable'))return this.attrs.contenteditable!==undefined;
    return sel===this.localName;
  });}
  querySelectorAll(query){return this.children.flatMap(c=>[...(c.matches(query)?[c]:[]),...c.querySelectorAll(query)]);}
  querySelector(query){return this.querySelectorAll(query)[0]||null;}
  cloneNode(deep){const n=new Node(this.localName,this.doc);n.attrs={...this.attrs};n.ownText=this.ownText;n.id=this.id;if(deep)this.children.forEach(c=>n.append(c.cloneNode(true)));return n;}
}
function guest(){
  const win=new Events();
  const doc={title:'设备页',createElement(tag){return new Node(tag,doc);},elementFromPoint(){return doc.hit;}};
  doc.documentElement=new Node('html',doc);doc.body=new Node('body',doc);doc.documentElement.append(doc.body);
  const target=doc.createElement('button');target.id='save';target.textContent='保存设备';doc.body.append(target);doc.hit=target;
  let serial=0;
  const sandbox={window:win,document:doc,Element:Node,location:{href:'http://localhost:5173/devices?access_token=secret&tab=active'},URL,CSS:{escape:s=>s},crypto:{randomUUID:()=>`annotation-${++serial}`},innerWidth:800,innerHeight:600,confirm:()=>true,alert:()=>{},setTimeout:()=>1,clearTimeout:()=>{}};
  vm.createContext(sandbox);vm.runInContext(`(${installGuestAnnotations.toString()})('session-A')`,sandbox);
  const api=()=>sandbox.__dshBrowserAnnotationV1;
  const root=()=>doc.documentElement.children.find(c=>c.attrs['data-dsh-browser-annotation'])?.shadowForTest;
  const click=(label)=>{const b=root().querySelectorAll('button').find(b=>b.textContent===label);assert.ok(b,`button ${label}`);b.emit('click');};
  const context=(extra={})=>win.emit('contextmenu',{composedPath:()=>[target,doc.body,doc.documentElement],clientX:30,clientY:50,...extra});
  return{doc,win,target,root,api,click,context,sandbox};
}
test('guest exposes exactly the two requested menu actions; quick queues one reference until acknowledged',()=>{
  const g=guest();const e=g.context();assert.equal(e.prevented,true);assert.equal(e.stopped,true);
  assert.deepEqual(g.root().querySelectorAll('button').map(b=>b.textContent),['Quick annotation','Annotation']);
  g.click('Quick annotation');const p=g.api().poll('session-A',null);
  assert.equal(p.mode,'quick');assert.equal(p.items.length,1);assert.equal(p.items[0].selector,'#save');
  assert.ok(!p.items[0].page.includes('secret'));assert.match(p.items[0].page,/tab=active/);
  assert.equal(g.api().poll('session-A',null).id,p.id);
  assert.equal(g.api().poll('session-A',p.id),null);
  assert.match(g.root().textContent,/请检查后发送/);
});
test('batch keeps several notes local until Finish, and Escape does not discard them',()=>{
  const g=guest();g.context();g.click('Annotation');
  assert.equal(g.root().querySelector('textarea'), null);
  assert.ok(g.root().querySelector('.picking'));
  const other=g.doc.createElement('div');other.id='toolbar';other.textContent='工具栏';g.doc.body.append(other);g.doc.hit=other;
  g.root().querySelector('.shield').emit('pointermove',{clientX:50,clientY:60});
  assert.ok(g.root().querySelector('.outline'));
  g.root().querySelector('.shield').emit('click',{clientX:50,clientY:60});
  assert.equal(g.root().querySelector('.picking'),null);
  g.root().querySelector('textarea').value='工具栏移到顶部';g.click('保存，继续标注');
  assert.equal(g.api().poll('session-A',null),null);
  g.win.emit('keydown',{key:'Escape'});
  assert.ok(g.root().querySelector('.picking'));
  assert.equal(g.root().querySelector('textarea'),null);
  const panel=g.root().querySelector('.panel');
  assert.equal(panel.querySelector('.saved-element').textContent,'工具栏');
  assert.equal(panel.querySelector('.saved-note').textContent,'工具栏移到顶部');
  assert.deepEqual(g.root().querySelectorAll('button'), panel.querySelectorAll('button'));
  g.doc.hit=g.target;
  g.root().querySelector('.shield').emit('click',{clientX:30,clientY:50});
  g.root().querySelector('textarea').value='按钮改为蓝色';g.click('完成并加入对话');
  const p=g.api().poll('session-A',null);assert.equal(p.mode,'batch');assert.equal(p.items.length,2);
  assert.equal(p.items[0].selector,'#toolbar');assert.equal(p.items[0].note,'工具栏移到顶部');
  assert.equal(p.items[1].selector,'#save');assert.equal(p.items[1].note,'按钮改为蓝色');
  assert.equal(g.root().querySelector('.shield'),null);
  assert.equal(g.root().querySelector('.panel'),null);
});
test('selection shields website controls; form values and script text are not collected',()=>{
  const g=guest();const input=g.doc.createElement('textarea');input.textContent='secret-field';input.value='typed-secret';
  const script=g.doc.createElement('script');script.textContent='secret-script';g.target.append(input,script);
  g.context();g.click('Quick annotation');const text=g.api().poll('session-A',null).items[0].text;
  assert.equal(text,'保存设备');
  const h=guest();h.context();h.click('Annotation');assert.ok(h.root().querySelector('.shield'));
  assert.equal(h.root().querySelectorAll('.shield').length,1);
});
test('Shift retains native context menu; cancelled batch and dispose send nothing',()=>{
  const g=guest();assert.equal(g.context({shiftKey:true}).prevented,undefined);
  assert.equal(g.root().querySelectorAll('button').length,0);
  g.context();g.click('Annotation');g.click('退出');assert.equal(g.api().poll('session-A',null),null);
  g.api().dispose();assert.equal(g.root(),undefined);
  for(const list of g.win.events.values())assert.equal(list.length,0);
});
test('guest refuses to migrate pending annotation to a different conversation',()=>{
  const g=guest();g.context();g.click('Quick annotation');
  assert.equal(g.api().poll('session-B',null).blocked,true);
  assert.equal(g.api().poll('session-A',null).sessionId,'session-A');
});
test('non-secure HTTP pages without randomUUID still generate an annotation id',()=>{
  const g=guest();g.sandbox.crypto={getRandomValues:array=>array.fill(42)};
  g.context();g.click('Quick annotation');
  assert.match(g.api().poll('session-A',null).id,/^[0-9a-f]{32}$/);
});

test('Finish while picking delivers saved notes without requiring an extra click on the page', () => {
  const g = guest();
  g.context();
  g.click('Annotation');
  g.root().querySelector('.shield').emit('click', {clientX: 30, clientY: 50});
  g.root().querySelector('textarea').value = '保留这条备注';
  g.click('保存，继续标注');
  g.click('完成并加入对话');
  assert.equal(g.api().poll('session-A', null).items[0].note, '保留这条备注');
  assert.equal(g.root().querySelector('.shield'), null);
});

test('finishing with an empty next element sends only previously saved notes', () => {
  const g = guest();
  g.context();
  g.click('Annotation');
  const pick = () => g.root().querySelector('.shield').emit('click', {clientX: 30, clientY: 50});
  pick();
  g.root().querySelector('textarea').value = '已写好的备注';
  g.click('保存，继续标注');
  pick();
  g.click('完成并加入对话');
  const packet = g.api().poll('session-A', null);
  assert.deepEqual(Array.from(packet.items, item => item.note), ['已写好的备注']);
});
