import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
const run=(command,args,options={})=>{
 const result=spawnSync(command,args,{stdio:'inherit',env:process.env,...options});
 if(result.error)throw result.error;
 if(result.status!==0)throw new Error(command+' exited '+result.status);
};
run(process.env.CARGO_BIN||'cargo',['build','--locked','--target','wasm32-unknown-unknown','--release'],{cwd:'engine'});
await fs.mkdir('src/wasm/generated',{recursive:true});
run(process.env.WASM_BINDGEN_BIN||'wasm-bindgen',['--target','web','--out-dir','src/wasm/generated','--out-name','aethelgard_engine','engine/target/wasm32-unknown-unknown/release/aethelgard_engine.wasm']);
const stat=await fs.stat('src/wasm/generated/aethelgard_engine_bg.wasm');
if(stat.size>32768)throw new Error('Pilot WASM exceeds the 32 KiB budget');
console.log('Combat pilot WASM: '+stat.size+' bytes');
