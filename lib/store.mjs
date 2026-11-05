import {AppError} from './core.mjs';

let clientPromise;
export async function mongoStore(){
 const uri=process.env.MONGODB_URI;
 if(!uri||!/^mongodb(?:\+srv)?:\/\//.test(uri))throw new AppError('The shared database is not connected yet. Ask the host to finish setup.',503);
 if(!clientPromise){
  clientPromise=(async()=>{const {MongoClient}=await import('mongodb');const c=new MongoClient(uri,{maxPoolSize:5,serverSelectionTimeoutMS:8000,connectTimeoutMS:8000,waitQueueTimeoutMS:4000,socketTimeoutMS:10000});try{await c.connect();return c;}catch(e){await c.close().catch(()=>{});throw e;}})().catch(e=>{clientPromise=null;throw e;});
 }
 const client=await clientPromise,col=client.db(process.env.MONGODB_DB||'dinner_on_sazz').collection('sessions');
 return {
  get:id=>col.findOne({_id:id}),
  async create(s){try{await col.insertOne(s);return true;}catch(e){if(e.code===11000)return false;throw e;}},
  async compareAndSwap(id,version,next){return (await col.replaceOne({_id:id,version},{...next,version:version+1})).modifiedCount===1;}
 };
}

// Explicit local rehearsal/test store. The production API never selects it.
export function memoryStore(){
 const sessions=new Map();
 return {
  async get(id){const s=sessions.get(id);return s?structuredClone(s):null;},
  async create(s){if(sessions.has(s._id))return false;sessions.set(s._id,structuredClone(s));return true;},
  async compareAndSwap(id,version,next){if(sessions.get(id)?.version!==version)return false;sessions.set(id,structuredClone({...next,version:version+1}));return true;}
 };
}
