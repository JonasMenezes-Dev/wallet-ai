import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const data=await import('../src/services/notification-confirmation-data.ts');
// Exercise the actual form and handlers. Replace only React scheduling, native views and I/O.
function form({pending=false,postedAt=Date.parse('2026-10-21T01:23:45.678Z'),summary={direction:'outgoing',amountCents:1234,date:'2026-10-20'}}={}){
  const hooks=[],effects=[],alerts=[],confirmations=[];let cursor=0;
  const react={
    useState(initial){const slot=cursor++;if(!(slot in hooks))hooks[slot]=typeof initial==='function'?initial():initial;
      return[hooks[slot],value=>{hooks[slot]=typeof value==='function'?value(hooks[slot]):value;}];},
    useRef(initial){const slot=cursor++;hooks[slot]??={current:initial};return hooks[slot];},
    useEffect(effect,deps){const slot=cursor++,old=hooks[slot];if(!old||deps.some((value,index)=>value!==old.deps[index])){
      old?.cleanup?.();hooks[slot]={deps};effects.push(()=>{hooks[slot].cleanup=effect();});}},
  };
  const native=Object.fromEntries(['ActivityIndicator','Text','TextInput','View'].map(name=>[name,name]));
  native.Alert={alert:(...args)=>alerts.push(args)};native.StyleSheet={create:styles=>styles};
  const dependencies={react,'react/jsx-runtime':require('react/jsx-runtime'),'react-native':native,
    './AnimatedPressable':{AnimatedPressable:'Button'},
    '../services/account.service':{listAccounts:async()=>[{id:1,name:'A',type:'bank'},{id:2,name:'B',type:'bank'}]},
    '../services/category.service':{listCategories:async()=>[{id:1,name:'Categoria'}]},
    '../services/notification-import.service':{notificationConfirmation:{available:true,pending:async()=>({requestJson:JSON.stringify({
      kind:'expense',amountCents:1234,accountId:1,toAccountId:null,categoryId:1,date:'2026-10-20',description:null})})}},
    '../services/notification-confirmation-data':data,
    '../theme':{useThemedStyles:create=>create({})},
  };
  const compiled=ts.transpileModule(readFileSync(new URL('../src/components/NotificationConfirmationForm.tsx',import.meta.url),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const module={exports:{}};
  new Function('require','module','exports',compiled)(name=>{assert.ok(name in dependencies,name);return dependencies[name];},module,module.exports);
  const props={localId:'event',postedAt,pending,summary,disabled:false,onConfirm:async(...args)=>confirmations.push(args)};
  const nodes=()=>{cursor=0;const result=[];const visit=node=>{if(Array.isArray(node))return node.forEach(visit);
    if(!node?.props)return;result.push(node);visit(node.props.children);};visit(module.exports.NotificationConfirmationForm(props));
    while(effects.length)effects.shift()();return result;};
  const text=node=>node?.props?text(node.props.children):Array.isArray(node)?node.map(text).join(''):String(node??'');
  return{alerts,confirmations,nodes,buttons:label=>nodes().filter(node=>node.type==='Button'&&text(node)===label),
    input:label=>nodes().find(node=>node.type==='TextInput'&&node.props.accessibilityLabel===label),
    async ready(){nodes();await new Promise(resolve=>setImmediate(resolve));nodes();},
    unmount(){for(const hook of hooks)hook?.cleanup?.();},
  };
}
test('form requires explicit account and category selection, with no financial write on opening',async()=>{
  const f=form();await f.ready();assert.equal(f.confirmations.length,0);
  assert.equal(f.buttons('A')[0].props.accessibilityState.checked,false);
  assert.equal(f.buttons('Categoria')[0].props.accessibilityState.checked,false);
  f.buttons('Confirmar movimentação')[0].props.onPress();assert.equal(f.alerts[0][0],'Confira os dados');
  assert.equal(f.confirmations.length,0);
});
test('financial handler runs only after final confirmation and ignores double tap',async()=>{
  const f=form();await f.ready();f.buttons('A')[0].props.onPress();f.buttons('Categoria')[0].props.onPress();
  f.buttons('Confirmar movimentação')[0].props.onPress();f.buttons('Confirmar movimentação')[0].props.onPress();
  assert.equal(f.alerts.length,1);assert.equal(f.confirmations.length,0);
  f.alerts[0][2].find(button=>button.text==='Confirmar').onPress();
  await new Promise(resolve=>setImmediate(resolve));assert.equal(f.confirmations.length,1);
  assert.equal(f.confirmations[0][0].kind,'expense');assert.equal(f.confirmations[0][0].accountId,1);
});
test('internal transfer requires explicit type and destination',async()=>{
  const f=form({summary:{direction:'internal',amountCents:1234,date:'2026-10-20'}});await f.ready();
  assert.equal(f.buttons('Entre minhas contas')[0].props.accessibilityState.checked,false);
  f.buttons('Entre minhas contas')[0].props.onPress();f.buttons('A')[0].props.onPress();
  f.buttons('Confirmar movimentação')[0].props.onPress();assert.equal(f.alerts[0][0],'Confira os dados');
  f.buttons('B').at(-1).props.onPress();f.buttons('Confirmar movimentação')[0].props.onPress();
  f.alerts[1][2].find(button=>button.text==='Confirmar').onPress();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.confirmations[0][0].kind,'internal_transfer');assert.equal(f.confirmations[0][0].toAccountId,2);
  assert.equal(f.confirmations[0][0].categoryId,null);
});
test('recovery form freezes approved data and requires explicit retry; unmounted form cannot submit',async()=>{
  const f=form({pending:true});await f.ready();assert.equal(f.buttons('A')[0].props.disabled,true);
  assert.equal(f.confirmations.length,0);f.buttons('Retomar confirmação')[0].props.onPress();
  assert.match(f.alerts[0][1],/criará a movimentação/);
  f.alerts[0][2].find(button=>button.text==='Retomar').onPress();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.confirmations[0][1],true);
  assert.equal(f.confirmations[0][0].date,'2026-10-20');
  const g=form();await g.ready();g.buttons('A')[0].props.onPress();g.buttons('Categoria')[0].props.onPress();
  g.buttons('Confirmar movimentação')[0].props.onPress();g.unmount();
  g.alerts[0][2].find(button=>button.text==='Confirmar').onPress();assert.equal(g.confirmations.length,0);
});

test('form uses captured local timestamp and saves user-edited date and time',async()=>{
  const previous=process.env.TZ;process.env.TZ='America/Sao_Paulo';
  try{
    const f=form();await f.ready();
    assert.equal(f.input('Data da movimentação').props.value,'2026-10-20');
    assert.equal(f.input('Hora da movimentação').props.value,'22:23:45.678');
    assert.equal(f.input('Hora da movimentação').props.editable,true);
    f.input('Data da movimentação').props.onChangeText('2026-10-25');
    f.input('Hora da movimentação').props.onChangeText('08:09:10.123');
    f.buttons('A')[0].props.onPress();f.buttons('Categoria')[0].props.onPress();
    f.buttons('Confirmar movimentação')[0].props.onPress();
    f.alerts[0][2].find(button=>button.text==='Confirmar').onPress();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(f.confirmations[0][0].date,'2026-10-25T08:09:10.123-03:00');
  }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
test('invalid captured timestamp leaves manual fields editable and blocks confirmation until supplied',async()=>{
  const f=form({postedAt:null});await f.ready();
  assert.equal(f.input('Data da movimentação').props.value,'');assert.equal(f.input('Hora da movimentação').props.value,'');
  assert.equal(f.input('Data da movimentação').props.editable,true);
  f.buttons('A')[0].props.onPress();f.buttons('Categoria')[0].props.onPress();
  f.buttons('Confirmar movimentação')[0].props.onPress();assert.equal(f.alerts[0][0],'Confira os dados');assert.equal(f.confirmations.length,0);
});
