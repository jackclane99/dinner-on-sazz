import {mongoStore} from '../lib/store.mjs';
import {service} from '../lib/service.mjs';
import {AppError} from '../lib/core.mjs';

export function makeHandler(storeFactory=mongoStore,hostPassword=()=>process.env.HOST_PASSWORD){
 return async (req,res)=>{
  res.setHeader('Cache-Control','no-store, private');res.setHeader('Vary','Authorization');
  const send=(status,value)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value));};
  try{
   if(req.method!=='GET'&&req.method!=='POST'){res.setHeader('Allow','GET, POST');return send(405,{error:'Method not allowed.'});}
   const host=req.headers['x-forwarded-host']||req.headers.host;
   const origin=req.headers.origin;
   if(origin){const allowed=process.env.APP_ORIGIN||`https://${host}`;if(origin!==allowed&&!(process.env.NODE_ENV!=='production'&&origin===`http://${host}`))throw new AppError('Open this app directly to submit.',403);}
   const url=new URL(req.url,'https://dinner.invalid');
   let body=req.body;
   if(req.method==='POST'&&!(req.headers['content-type']||'').startsWith('application/json'))throw new AppError('Use a JSON request.',415);
   if(typeof body==='string')body=JSON.parse(body);
   if(req.method==='POST'&&(!body||typeof body!=='object'||Array.isArray(body)))throw new AppError('Invalid request.');
   if(body&&Buffer.byteLength(JSON.stringify(body))>12000)throw new AppError('That submission is too large.',413);
   const id=req.method==='GET'?url.searchParams.get('id'):body.id;
   const action=req.method==='GET'?'state':body.action;
   if(req.method==='POST'&&action==='state')throw new AppError('Use GET to read a session.');
   const token=(req.headers.authorization||'').replace(/^Bearer /,'');
   const run=service(await storeFactory(),{hostPassword:hostPassword()});
   return send(200,await run({action,id,token,payload:body?.payload||{}}));
  }catch(e){
   if(e instanceof AppError)return send(e.status,{error:e.message});
   if(e instanceof SyntaxError)return send(400,{error:'That request could not be read.'});
   // Never expose MongoDB error messages, URIs, passwords or request bodies.
   console.error('Dinner API failure:',e.name||'Error',e.code||'');
   return send(503,{error:'The shared connection is unavailable. Retry in a moment. Your saved votes have not been cleared.'});
  }
 };
}
export default makeHandler();
