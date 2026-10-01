import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createOperationId} from '../src/utils/operationId';
test('operation UUIDs work without randomUUID in desktop embedded browsers',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');
 try{
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues:webcrypto.getRandomValues.bind(webcrypto)}});
  const ids=new Set(Array.from({length:100},()=>createOperationId()));assert.equal(ids.size,100);
  for(const id of ids)assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{}});assert.throws(()=>createOperationId(),/Обновите Telegram/);
 }finally{if(descriptor)Object.defineProperty(globalThis,'crypto',descriptor);else delete (globalThis as any).crypto;}
});
