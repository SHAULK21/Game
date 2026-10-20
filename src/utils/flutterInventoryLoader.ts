export interface FlutterInventoryApp {addView(options:{hostElement:HTMLElement}):number;removeView(id:number):unknown}
declare global {interface Window {
 aethelgardFlutterReady?:(app:FlutterInventoryApp)=>void;
 aethelgardFlutterFailed?:(error:unknown)=>void;
 aethelgardInventoryUpdate?:(json:string)=>void;
 aethelgardInventoryAction?:(json:string)=>Promise<string>;
}}
let engine:Promise<FlutterInventoryApp>|undefined;
/** The Flutter runtime is fetched only when the inventory is opened, once per document. */
export function loadFlutterInventory():Promise<FlutterInventoryApp> {
 return engine??=new Promise(async(resolve,reject)=>{
  const timer=window.setTimeout(()=>reject(Error('Inventory startup timeout')),30000);
  const fail=(error:unknown)=>{clearTimeout(timer);reject(error);};
  window.aethelgardFlutterFailed=fail;
  window.aethelgardFlutterReady=app=>{clearTimeout(timer);resolve(app);};
  try {
   const response=await fetch('/flutter-inventory.json',{cache:'no-store',credentials:'omit'});
   if(!response.ok)throw Error('Inventory build unavailable');
   const manifest=await response.json();
   if(manifest.protocol!==1||!/^[a-f0-9]{12}$/.test(manifest.version)||manifest.baseUrl!==`/flutter-inventory/${manifest.version}/`)throw Error('Invalid inventory build');
   const script=document.createElement('script');script.src=manifest.baseUrl+'flutter_bootstrap.js';script.async=true;script.onerror=()=>fail(Error('Inventory download failed'));document.head.appendChild(script);
  } catch(error) {fail(error);}
 });
}
