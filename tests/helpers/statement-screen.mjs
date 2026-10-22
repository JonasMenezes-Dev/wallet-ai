import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);

export function createStatementScreen({accounts,categories,file,parsers,service}) {
 const hooks=[],alerts=[],effects=[]; let cursor=0;
 const react={
  useState(initial){const slot=cursor++;if(!(slot in hooks))hooks[slot]=typeof initial==='function'?initial():initial;return[hooks[slot],value=>hooks[slot]=typeof value==='function'?value(hooks[slot]):value];},
  useRef(initial){const slot=cursor++;if(!(slot in hooks))hooks[slot]={current:initial};return hooks[slot];},
  useEffect(effect){const slot=cursor++;if(!(slot in hooks)){hooks[slot]=true;effects.push(effect);}},
 };
 const native=Object.fromEntries(['ActivityIndicator','FlatList','Modal','ScrollView','View'].map(name=>[name,name]));
 native.StyleSheet={create:value=>value}; native.Alert={alert:(...args)=>alerts.push(args)};
 const deps={react,'react/jsx-runtime':require('react/jsx-runtime'),'react-native':native,'expo-router':{router:{back(){}}},
  'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},
  'react-native-reanimated':{useReducedMotion:()=>true},
  '../src/services/account.service':{listAccounts:async()=>accounts},'../src/services/category.service':{listCategories:async()=>categories},
  '../src/services/statement-parsers':parsers,'../src/services/statement-import.service':service,
  '../src/services/statement-file':{pickStatementFile:async()=>file,statementBankScope:async()=> 'csv:unspecified'},
  '../src/theme':{useThemeColors:()=>({primary:'#0c6'}),radii:{sm:8},spacing:{sm:8,md:12,lg:16,xl:24}},
 };
 for(const name of ['AppText','AppField','AppButton','AppCard','AppSelector','AnimatedPressable','PremiumScreen','ScreenHeader','WalletSymbol'])deps[`../src/components/${name}`]={[name]:name};
 const compiled=ts.transpileModule(readFileSync(new URL('../../app/statement-import.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const module={exports:{}};
 new Function('require','module','exports',compiled)(name=>{if(!(name in deps))throw Error(`Unexpected dependency ${name}`);return deps[name];},module,module.exports);
 function nodes(){cursor=0;const result=[];function visit(node){if(Array.isArray(node))return node.forEach(visit);if(!node?.props)return;result.push(node);visit(node.props.children);visit(node.props.ListHeaderComponent);if(node.type==='FlatList')node.props.data.forEach(item=>visit(node.props.renderItem({item})));}visit(module.exports.default());while(effects.length)effects.shift()();return result;}
 const find=(type,key,value)=>nodes().find(node=>node.type===type&&node.props[key]===value);
 async function settle(){for(let i=0;i<20;i++){await new Promise(resolve=>setTimeout(resolve,5));nodes();if(!nodes().some(node=>node.type==='ActivityIndicator'))break;}}
 return{alerts,nodes,settle,button:label=>find('AppButton','label',label),selector:label=>find('AppSelector','accessibilityLabel',label),field:label=>find('AppField','label',label),
  async press(label){const button=find('AppButton','label',label);if(!button)throw Error(`Missing button ${label}`);if(button.props.disabled)throw Error(`Disabled button ${label}`);button.props.onPress();await settle();},
 };
}
