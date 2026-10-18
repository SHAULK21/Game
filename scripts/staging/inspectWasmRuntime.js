export default async function(){
 const available=typeof WebAssembly!=='undefined';
 if(!available)return {available:false,canCompile:false};
 try{
  new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0]));
  return {available:true,canCompile:true};
 }catch(error){return {available:true,canCompile:false,error:error.name};}
}
