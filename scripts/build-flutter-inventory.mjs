import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const project=path.join(root,'flutter/inventory');
const portable=path.join(root,'.migration-backups/flutter-sdk/bin',process.platform==='win32'?'flutter.bat':'flutter');
let command=process.env.FLUTTER_BIN||await fs.access(portable).then(()=>portable,()=>process.platform==='win32'?'flutter.bat':'flutter');
let workingProject=project;
let pubCache=process.env.PUB_CACHE||path.join(root,'.migration-backups/flutter-pub-cache');
// Flutter's Windows shader tool needs ASCII paths. Compile a disposable copy
// when the checkout path contains spaces/Cyrillic; sources stay in the repo.
if(process.platform==='win32'&&/[^\x00-\x7f]|\s/.test(root)){
 const alias=path.join(os.tmpdir(),'aethelgard-flutter-'+crypto.createHash('sha256').update(root).digest('hex').slice(0,8));
 await fs.mkdir(alias,{recursive:true});
 workingProject=path.join(alias,'project');await fs.mkdir(workingProject,{recursive:true});
 for(const name of ['lib','web','assets','test','pubspec.yaml','pubspec.lock']){
  const from=path.join(project,name),to=path.join(workingProject,name);
  if(await fs.access(from).then(()=>true,()=>false)){
   if(path.relative(alias,to).startsWith('..'))throw Error('Unexpected Flutter temporary target');
   await fs.rm(to,{recursive:true,force:true});await fs.cp(from,to,{recursive:true});
  }
 }
 pubCache=path.join(alias,'cache');await fs.mkdir(pubCache,{recursive:true});
 if(command===portable){
  const sdkCopy=path.join(alias,'sdk-3.47.7');
  if(!await fs.access(path.join(sdkCopy,'bin/flutter.bat')).then(()=>true,()=>false)){
   console.log('Preparing ASCII Flutter SDK path for Windows…');await fs.cp(path.dirname(path.dirname(portable)),sdkCopy,{recursive:true});
  }
  command=path.join(sdkCopy,'bin/flutter.bat');
 }
}
export function runFlutter(args) {
 const env={...process.env,CI:'true',FLUTTER_SUPPRESS_ANALYTICS:'true',PUB_CACHE:pubCache};
 const quote=s=>`'${s.replaceAll("'","''")}'`;
 const child=process.platform==='win32'
  ?spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`& ${quote(command)} ${args.map(quote).join(' ')}; exit $LASTEXITCODE`],{cwd:workingProject,env,stdio:'inherit'})
  :spawnSync(command,args,{cwd:workingProject,env,stdio:'inherit'});
 if(child.error)throw child.error;if(child.status!==0)throw Error('Flutter command failed: '+args.join(' '));
}
export async function buildFlutterInventory() {
 runFlutter(['pub','get']);
 await fs.copyFile(path.join(workingProject,'pubspec.lock'),path.join(project,'pubspec.lock'));
 const hash=crypto.createHash('sha256');
 async function visit(dir){for(const entry of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const file=path.join(dir,entry.name);if(entry.isDirectory())await visit(file);else hash.update(path.relative(project,file)).update(await fs.readFile(file));}}
 for(const dir of ['lib','web','assets'])await visit(path.join(project,dir));
 hash.update(await fs.readFile(path.join(project,'pubspec.lock'))).update('flutter-3.47.7');
 const version=hash.digest('hex').slice(0,12),baseUrl=`/flutter-inventory/${version}/`;
 runFlutter(['build','web','--release','--no-web-resources-cdn','--base-href',baseUrl]);
 const output=path.resolve(root,'public/flutter-inventory');
 if(path.relative(root,output)!==path.join('public','flutter-inventory'))throw Error('Unexpected generated output');
 await fs.rm(output,{recursive:true,force:true});await fs.mkdir(path.join(output,version),{recursive:true});
 await fs.cp(path.join(workingProject,'build/web'),path.join(output,version),{recursive:true,filter:source=>{
  const name=path.basename(source);
  return !name.startsWith('.')&&!name.endsWith('.symbols')&&!/^(?:skwasm|wimp)/.test(name)&&name!=='flutter_service_worker.js';
 }});
 await fs.writeFile(path.join(root,'public/flutter-inventory.json'),JSON.stringify({protocol:1,version,baseUrl,flutterVersion:'3.47.7'})+'\n');
 console.log(JSON.stringify({flutterInventory:true,version,baseUrl,loading:'on-inventory-open'}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.includes('--test'))runFlutter(['test']);else if(process.argv.includes('--analyze'))runFlutter(['analyze']);else await buildFlutterInventory();
}
