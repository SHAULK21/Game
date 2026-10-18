import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';

test('the existing Vite bundler emits the opt-in WASM adapter with a lazy binding chunk',async()=>{
 const result=await build({configFile:false,logLevel:'silent',build:{write:false,minify:true,target:'es2020',
  lib:{entry:'src/wasm/combatEngine.ts',formats:['es']}}});
 const outputs=(Array.isArray(result)?result:[result]).flatMap(result=>('output'in result?result.output:[]));
 const entry=outputs.find(output=>output.type==='chunk'&&output.isEntry);
 assert(entry?.type==='chunk');assert(entry.dynamicImports.length>0);
 assert(!entry.code.includes('WebAssembly.instantiate'),'WASM runtime must stay out of the initial adapter');
 assert(outputs.some(output=>output.type==='chunk'&&!output.isEntry&&output.code.includes('WebAssembly')),'Lazy bindings must be included');
});
