import test from 'node:test';
import assert from 'node:assert/strict';
import {getWriterSession} from '../src/utils/writerSession';
class MemoryStorage {
 data=new Map<string,string>();
 getItem(key:string){return this.data.get(key)??null;}
 setItem(key:string,value:string){this.data.set(key,value);}
}
test('closing the WebView preserves the writer on the same device and isolates accounts/devices',()=>{
 const disk=new MemoryStorage(),first=getWriterSession('1',disk,new MemoryStorage());
 assert.equal(getWriterSession('1',disk,new MemoryStorage()),first);
 assert.notEqual(getWriterSession('2',disk,new MemoryStorage()),first);
 assert.notEqual(getWriterSession('1',new MemoryStorage(),new MemoryStorage()),first);
});
test('upgrade preserves the old active tab token, then durable identity wins over stale tabs',()=>{
 const disk=new MemoryStorage(),tab=new MemoryStorage(),key='aethelgard_writer_1',old=crypto.randomUUID();
 tab.setItem(key,old);
 assert.equal(getWriterSession('1',disk,tab),old);
 tab.setItem(key,crypto.randomUUID());
 assert.equal(getWriterSession('1',disk,tab),old);
 assert.equal(tab.getItem(key),old);
});
test('invalid tokens are replaced; unavailable durable storage keeps a usable tab identity',()=>{
 const disk=new MemoryStorage(),tab=new MemoryStorage(),key='aethelgard_writer_1';
 disk.setItem(key,'broken');tab.setItem(key,'broken');
 const token=getWriterSession('1',disk,tab);
 assert.equal(disk.getItem(key),token);assert.notEqual(token,'broken');
 const unavailable={getItem(){throw new Error('blocked');},setItem(){throw new Error('quota');}};
 assert.equal(getWriterSession('1',unavailable,tab),token);
});
