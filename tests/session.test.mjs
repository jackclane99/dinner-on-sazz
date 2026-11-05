import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {service} from '../lib/service.mjs';
import {memoryStore} from '../lib/store.mjs';
import {leaderboard,googleURL} from '../public/shared.mjs';
import {createSession,mutateSession,visibleSession,authenticate} from '../lib/core.mjs';
import {makeHandler} from '../api/session.mjs';
import {createServer} from 'node:http';

const password='a-private-test-host-password';
const token=()=>randomBytes(32).toString('hex');
async function setup(count=3){
 const store=memoryStore(),run=service(store,{hostPassword:password}),id=randomUUID(),host=token();
 const call=(action,t=host,payload={})=>run({action,id,token:t,payload});
 await call('create',host,{password});
 const members=[];
 for(let i=0;i<count;i++){
  const m={id:randomUUID(),token:token(),name:'Person '+i,restaurant:'Restaurant '+i};members.push(m);
  await call('nominate',m.token,{memberId:m.id,name:m.name,restaurant:m.restaurant});
 }
 return {store,run,id,host,members,call};
}
const ballot=(s,value)=>Object.fromEntries(s.restaurants.map(r=>[r.id,value]));

test('complete group flow: host, nominations, secret ballots, reveal and individual scores',async()=>{
 const h=await setup(),before=await h.call('state');assert.equal(before.participants.length,3);
 await h.call('open-voting');
 for(let i=0;i<3;i++)await h.call('vote',h.members[i].token,{ratings:ballot(before,i+3)});
 const hostView=await h.call('state');assert.equal(hostView.participants.filter(p=>p.submitted).length,3);
 assert.ok(!JSON.stringify(hostView).includes('ratings'));assert.equal(hostView.results,undefined);
 const other=await h.call('state',h.members[0].token);assert.equal(other.me.ratings[before.restaurants[0].id],3);assert.equal(other.results,undefined);
 assert.equal(other.participants[1].ratings,undefined);
 const result=await h.call('reveal');assert.equal(result.phase,'results');assert.equal(result.results[0].average,4);
 assert.equal(result.results[0].ratings.length,3);assert.equal(result.results[0].rank,1);assert.equal(result.results[1].rank,1);
});
test('participant and guest cannot operate host controls, impersonate members, or inspect hidden results',async()=>{
 const h=await setup(),p=h.members[0];
 for(const action of ['open-voting','merge','reveal'])await assert.rejects(h.call(action,p.token,{source:'x',target:'y'}),e=>e.status===403);
 await assert.rejects(h.call('nominate',p.token,{memberId:h.members[1].id,name:'Fake',restaurant:'Fake'}),e=>e.status===403);
 const guest=await h.call('state',token());assert.deepEqual(Object.keys(guest).sort(),['id','participantCount','phase','revealAt','role','title','version'].sort());
 assert.ok(!JSON.stringify(await h.call('state')).includes('hostHash'));assert.ok(!JSON.stringify(await h.call('state')).includes(p.token));
});
test('host creation is password-protected and retries preserve the same session',async()=>{
 const run=service(memoryStore(),{hostPassword:password}),id=randomUUID(),t=token();
 await assert.rejects(run({action:'create',id,token:t,payload:{password:'wrong'}}),e=>e.status===403);
 await run({action:'create',id,token:t,payload:{password}});
 assert.equal((await run({action:'create',id,token:t,payload:{password}})).id,id);
 await assert.rejects(run({action:'create',id,token:token(),payload:{password}}),e=>e.status===409);
});
test('nominations edit safely, combine exact duplicates, and host can merge spelling variants',async()=>{
 const h=await setup(2),p=h.members[0],q=h.members[1];
 await h.call('nominate',p.token,{memberId:p.id,name:p.name,restaurant:'  restaurant 1  '});
 let s=await h.call('state');assert.equal(s.restaurants.length,1);
 await h.call('nominate',p.token,{memberId:p.id,name:p.name,restaurant:'Restaurant One'});
 s=await h.call('state');assert.equal(s.restaurants.length,2);
 await h.call('merge',h.host,{source:s.restaurants[0].id,target:s.restaurants[1].id});
 s=await h.call('state');assert.equal(s.restaurants.length,1);assert.equal(s.participants[0].restaurantId,s.participants[1].restaurantId);
 await assert.rejects(h.call('open-voting'),/two different restaurants/);
 await assert.rejects(h.call('nominate',q.token,{memberId:q.id,name:p.name,restaurant:'X'}),/already in use/);
});
test('complete integer ballots only; edits replace rather than add ballots',async()=>{
 const h=await setup(2),s=await h.call('open-voting'),p=h.members[0];
 for(const ratings of [{},ballot(s,0),ballot(s,6),ballot(s,2.5),{...ballot(s,5),extra:2}])await assert.rejects(h.call('vote',p.token,{ratings}),/Rate every restaurant/);
 await h.call('vote',p.token,{ratings:ballot(s,5)});await h.call('vote',p.token,{ratings:ballot(s,3)});
 assert.equal((await h.call('state')).participants.filter(p=>p.submitted).length,1);
 assert.equal((await h.call('state',p.token)).me.ratings[s.restaurants[0].id],3);
});
test('early reveal requires confirmation; partial and late ballots do not count',async()=>{
 const h=await setup(2),s=await h.call('open-voting');
 await assert.rejects(h.call('reveal',h.host,{confirmEarly:true}),/At least one/);
 await h.call('vote',h.members[0].token,{ratings:ballot(s,4)});
 await assert.rejects(h.call('reveal'),e=>e.status===409);
 const result=await h.call('reveal',h.host,{confirmEarly:true});assert.equal(result.results[0].voters,1);
 await assert.rejects(h.call('vote',h.members[1].token,{ratings:ballot(s,5)}),e=>e.status===409);
 await assert.rejects(h.call('nominate',h.members[0].token,{memberId:h.members[0].id,name:'A',restaurant:'B'}),e=>e.status===409);
});
test('concurrent nominations and voting do not lose writes',async()=>{
 const h=await setup(0),members=Array.from({length:8},(_,i)=>({id:randomUUID(),token:token(),name:'Concurrent '+i,restaurant:'Place '+i}));
 await Promise.all(members.map(m=>h.call('nominate',m.token,{memberId:m.id,name:m.name,restaurant:m.restaurant})));
 let s=await h.call('state');assert.equal(s.participants.length,8);assert.equal(s.restaurants.length,8);
 await h.call('open-voting');await Promise.all(members.map(m=>h.call('vote',m.token,{ratings:ballot(s,4)})));
 s=await h.call('reveal');assert.equal(s.results[0].voters,8);
});
test('concurrent reveal and last submission produce a consistent snapshot',async()=>{
 const h=await setup(2),s=await h.call('open-voting');
 await h.call('vote',h.members[0].token,{ratings:ballot(s,4)});
 await Promise.allSettled([h.call('reveal',h.host,{confirmEarly:true}),h.call('vote',h.members[1].token,{ratings:ballot(s,5)})]);
 const final=await h.call('state');assert.equal(final.phase,'results');
 const complete=final.participants.filter(p=>p.submitted).length;
 assert.equal(final.results[0].voters,complete);
});
test('rank by exact averages, then count of fives, and retain true ties',()=>{
 const s={restaurants:[{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'}],participants:[{name:'P',ratings:{a:5,b:4,c:5}},{name:'Q',ratings:{a:3,b:4,c:3}}]};
 const rows=leaderboard(s);assert.equal(rows[0].id,'a');assert.equal(rows[1].id,'c');assert.equal(rows[2].id,'b');assert.equal(rows[0].rank,1);assert.equal(rows[1].rank,1);assert.equal(rows[2].rank,3);
 const precise={restaurants:[{id:'a',name:'A'},{id:'b',name:'B'}],participants:Array.from({length:30},(_,i)=>({name:String(i),ratings:{a:4,b:i===0?3:4}}))};
 assert.equal(leaderboard(precise)[0].id,'a');
});
test('expired sessions and malformed IDs are rejected; searches safely encode nominations',async()=>{
 const h=await setup();const expired=service(h.store,{hostPassword:password,now:()=>Date.now()+8*86400000});
 await assert.rejects(expired({action:'state',id:h.id,token:h.host}),e=>e.status===404);
 await assert.rejects(h.run({action:'state',id:'bad',token:h.host}),/full invitation/);
 const name='A&B / Chicago? #1';assert.equal(new URL(googleURL(name)).searchParams.get('q'),name+' Chicago restaurant');
});
test('state and credentials persist when a new service instance uses the same database',async()=>{
 const h=await setup(2);const second=service(h.store,{hostPassword:password});
 const s=await second({action:'state',id:h.id,token:h.members[0].token});assert.equal(s.me.name,'Person 0');assert.equal(s.participants.length,2);
});
test('real HTTP requests: independent clients, server permission checks and safe failures',async t=>{
 const store=memoryStore(),handler=makeHandler(async()=>store,()=>password);
 const server=createServer(async(req,res)=>{let data='';for await(const chunk of req)data+=chunk;if(data)req.body=data;await handler(req,res);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}/api/session`,id=randomUUID(),host=token(),alice=token(),bob=token();
 const req=async(action,secret,payload={})=>{const r=await fetch(base,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+secret},body:JSON.stringify({id,action,payload})});return {status:r.status,body:await r.json()};};
 assert.equal((await req('create',host,{password})).status,200);
 await req('nominate',alice,{memberId:randomUUID(),name:'Alice',restaurant:'A'});
 await req('nominate',bob,{memberId:randomUUID(),name:'Bob',restaurant:'B'});
 assert.equal((await req('open-voting',alice)).status,403);
 const started=await req('open-voting',host);await req('vote',alice,{ratings:ballot(started.body,5)});await req('vote',bob,{ratings:ballot(started.body,3)});
 const hidden=await fetch(base+'?id='+id,{headers:{Authorization:'Bearer '+host}}).then(r=>r.json());assert.equal(hidden.results,undefined);
 const done=await req('reveal',host);assert.equal(done.body.results[0].average,4);
 const participant=await fetch(base+'?id='+id,{headers:{Authorization:'Bearer '+alice}}).then(r=>r.json());assert.equal(participant.phase,'results');assert.deepEqual(participant.results,done.body.results);
 const cross=await fetch(base,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://other.invalid'},body:JSON.stringify({id,action:'reveal'})});assert.equal(cross.status,403);
});
