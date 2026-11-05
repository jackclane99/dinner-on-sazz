import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {makeHandler} from '../api/session.mjs';
import {memoryStore,mongoStore} from '../lib/store.mjs';

const local=process.argv.includes('--local-rehearsal');
if(local&&process.env.VERCEL)throw Error('Local rehearsal mode cannot run on Vercel.');
const memory=local?memoryStore():null;
const handler=makeHandler(local?async()=>memory:mongoStore,()=>process.env.HOST_PASSWORD||(local?'rehearsal-host-only':undefined));
const root=fileURLToPath(new URL('../public/',import.meta.url));
const types={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/session'){
   if(req.method==='POST'){
    let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>12000){res.writeHead(413);res.end();return;}}
    req.body=body;
   }
   await handler(req,res);return;
  }
  if(url.pathname==='/api/config'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({localRehearsal:local}));return;}
  const name=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).slice(1);
  if(!['index.html','style.css','app.mjs','shared.mjs','mark.svg'].includes(name)){res.writeHead(404);res.end('Not found');return;}
  const bytes=await readFile(path.join(root,name));res.setHeader('Content-Type',types[path.extname(name)]||'text/plain');res.setHeader('Cache-Control','no-store');res.end(bytes);
 }catch{res.writeHead(500);res.end('Server error');}
});
const port=Number(process.env.PORT||3000);server.listen(port,'127.0.0.1',()=>console.log(`Dinner on Sazz: http://127.0.0.1:${port}${local?' — LOCAL REHEARSAL ONLY, temporary memory; host password: rehearsal-host-only':''}`));
