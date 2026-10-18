interface TokenStorage {
 getItem(key:string):string|null;
 setItem(key:string,value:string):void;
}
const validToken=(value:string|null):value is string=>!!value&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

/** A writer belongs to this device/account, not a single WebView launch.
 * Preserve the old tab token on upgrade; other devices still need an explicit transfer.
 * Operation journals retain their own original token independently of this identity. */
export function getWriterSession(ownerId:string,durable:TokenStorage,tab:TokenStorage,create=()=>crypto.randomUUID()):string {
 const key='aethelgard_writer_'+ownerId;
 const read=(storage:TokenStorage)=>{try{return storage.getItem(key);}catch{return null;}};
 const write=(storage:TokenStorage,value:string)=>{try{storage.setItem(key,value);}catch{/* Fall back to the current tab when persistent storage is unavailable. */}};
 const saved=read(durable),legacy=read(tab);
 const token=validToken(saved)?saved:validToken(legacy)?legacy:create();
 write(durable,token);
 write(tab,token);
 return token;
}
