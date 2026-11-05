import {AppError,createSession,assertActive,authenticate,visibleSession,mutateSession,equalSecret,uuid} from './core.mjs';

export function service(store,{hostPassword,now=()=>Date.now()}={}){
 return async ({action,id,token,payload={}})=>{
  if(!uuid(id))throw new AppError('Open the full invitation link from your host.');
  if(action==='create'){
   if(!hostPassword||hostPassword.length<16)throw new AppError('Host setup is incomplete. Set a private HOST_PASSWORD of at least 16 characters in Vercel.',503);
   if(typeof payload.password!=='string'||!equalSecret(payload.password,hostPassword))throw new AppError('The host password is incorrect.',403);
   const s=createSession(id,token,now());
   if(await store.create(s))return visibleSession(s,{role:'host'});
   const existing=await store.get(id);assertActive(existing,now());
   if(authenticate(existing,token).role!=='host')throw new AppError('That session already exists.',409);
   return visibleSession(existing,{role:'host'});
  }
  for(let attempt=0;attempt<12;attempt++){
   const current=await store.get(id);assertActive(current,now());
   if(action==='state')return visibleSession(current,authenticate(current,token));
   const next=mutateSession(current,action,payload,token,now());
   if(await store.compareAndSwap(id,current.version,next))return visibleSession({...next,version:current.version+1},authenticate(next,token));
  }
  throw new AppError('Several people submitted together. Please retry; your existing submission is safe.',409);
 };
}
