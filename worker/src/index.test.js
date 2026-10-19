import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair, SignJWT} from 'jose';
import worker, {authorize} from './index.js';
const env = {SITE_ORIGIN:'https://patrickbats.github.io',FIREBASE_PROJECT:'patrickbatsell-site',OWNER_EMAIL:'jbatsell65@gmail.com'};
const {privateKey,publicKey} = await generateKeyPair('RS256');
async function token(overrides={}) {
  return new SignJWT({email:env.OWNER_EMAIL,email_verified:true,auth_time:Math.floor(Date.now()/1000),firebase:{sign_in_provider:'google.com'},...overrides})
    .setProtectedHeader({alg:'RS256'}).setSubject('owner-test').setIssuedAt()
    .setIssuer(`https://securetoken.google.com/${env.FIREBASE_PROJECT}`).setAudience(env.FIREBASE_PROJECT).setExpirationTime('1h').sign(privateKey);
}
test('only verified Google owner tokens with valid signatures are accepted',async()=>{
  await authorize(await token(),env,publicKey);
  for (const claims of [{email:'someone@example.com'},{email_verified:false},{firebase:{sign_in_provider:'password'}},{auth_time:9999999999}]) {
    await assert.rejects(authorize(await token(claims),env,publicKey));
  }
  const other = await generateKeyPair('RS256');
  await assert.rejects(authorize(await token(),env,other.publicKey));
  await assert.rejects(authorize(await token(),{...env,FIREBASE_PROJECT:'wrong-project'},publicKey));
  const expired = await new SignJWT({}).setProtectedHeader({alg:'RS256'}).setExpirationTime(1).sign(privateKey);
  await assert.rejects(authorize(expired,env,publicKey));
});
test('unauthenticated reads never touch database',async()=>{
  const response = await worker.fetch(new Request('https://test/visits'),env);
  assert.equal(response.status,401);
  assert.equal(response.headers.get('Cache-Control'),'no-store');
});
function visit(body) {
  const request = new Request('https://test/visit',{method:'POST',headers:{Origin:env.SITE_ORIGIN,'CF-Connecting-IP':'192.0.2.10','X-Forwarded-For':'198.51.100.1'},...(body?{body}: {})});
  Object.defineProperty(request,'cf',{value:{city:'Test city',country:'US',latitude:'0',longitude:'0'}});
  return request;
}
test('uses only edge IP; accepts zero coordinates; parameterizes values',async()=>{
  let values;
  const DB = {prepare:()=>({bind:(...args)=>{values=args;return {run:async()=>({success:true})};}})};
  const response = await worker.fetch(visit(),{...env,DB,VISIT_LIMITER:{limit:async()=>({success:true})}});
  assert.equal(response.status,204);
  assert.equal(values[1],'192.0.2.10');
  assert.deepEqual(values.slice(-2),[0,0]);
});
test('rejects submitted body, missing edge metadata and wrong origins',async()=>{
  assert.equal((await worker.fetch(visit('{"ip":"198.51.100.1"}'),env)).status,400);
  const request = new Request('https://test/visit',{method:'POST',headers:{Origin:env.SITE_ORIGIN}});
  assert.equal((await worker.fetch(request,env)).status,400);
  assert.equal((await worker.fetch(new Request('https://test/visit',{method:'POST'}),env)).status,403);
});
test('rate limits before database writes and handles exhausted quota',async()=>{
  assert.equal((await worker.fetch(visit(),{...env,VISIT_LIMITER:{limit:async()=>({success:false})}})).status,429);
  assert.equal((await worker.fetch(visit(),{...env,VISIT_LIMITER:{limit:async()=>({success:true})},DB:{prepare:()=>{throw Error('quota');}}})).status,503);
});
test('Cloudflare zero-byte POST streams are accepted',async()=>{
  const request=visit();
  Object.defineProperty(request,'body',{value:new ReadableStream({start(c){c.close();}})});
  const DB={prepare:()=>({bind:()=>({run:async()=>({success:true})})})};
  assert.equal((await worker.fetch(request,{...env,DB,VISIT_LIMITER:{limit:async()=>({success:true})}})).status,204);
});
