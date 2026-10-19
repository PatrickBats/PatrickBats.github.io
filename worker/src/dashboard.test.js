import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const code = fs.readFileSync(new URL('../../visitors.js',import.meta.url),'utf8');
function setup(fetch) {
 const elements = new Map();
 const element = () => ({textContent:'',hidden:false,disabled:false,value:'new',children:[],append(x){this.children.push(x);},replaceChildren(){this.children=[];}});
 const get = id => {if(!elements.has(id)) elements.set(id,element());return elements.get(id);};
 let listener;
 const auth = {currentUser:null,onAuthStateChanged(fn){listener=fn;},async signOut(){this.currentUser=null;listener(null);}};
 const firebase = {initializeApp(){},auth:()=>auth};
 const markers = {count:0,addTo(){return this;},clearLayers(){this.count=0;}};
 const L = {map:()=>({}),tileLayer:()=>({addTo(){}}),layerGroup:()=>markers,circleMarker:()=>({addTo(){markers.count++;return this;},bindPopup(){}})};
 const context = vm.createContext({firebase,L,window:{ANALYTICS_API:'https://test'},document:{getElementById:get,createElement:element},AbortController,fetch,console});
 vm.runInContext(code,context);
 return {get,auth,markers,change(user){auth.currentUser=user;listener(user);}};
}
const owner={uid:'owner',email:'jbatsell65@gmail.com',emailVerified:true,getIdToken:async()=>'test'};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('wrong account is not queried',async()=>{
 let calls=0; const app=setup(async()=>{calls++;});
 app.change({...owner,email:'someone@example.com'}); await tick();
 assert.equal(calls,0);assert.equal(app.get('private-controls').hidden,true);
});
test('logout prevents a pending response from restoring private data',async()=>{
 let resolve; const app=setup(()=>new Promise(r=>{resolve=r;}));
 app.change(owner);await tick();app.change(null);
 resolve({ok:true,json:async()=>({visits:[{ip:'192.0.2.1',city:'Test',country:'US',timestamp:1,lat:0,lon:0}],next:null})});
 await tick();assert.equal(app.get('visit-log').children.length,0);assert.equal(app.markers.count,0);
});
test('owner sees text-only records and pagination; logout clears records',async()=>{
 let requestURL;
 const app=setup(async(url)=>{requestURL=url;return {ok:true,json:async()=>({visits:[{ip:'192.0.2.1',city:'<script>bad</script>',country:'US',timestamp:1,lat:0,lon:0,repeatCount:1}],next:'25'})};});
 app.change(owner);await tick();
 assert.equal(app.get('visit-log').children.length,1);assert.equal(app.get('next').disabled,false);assert.equal(app.markers.count,1);
 app.get('next').onclick();await tick();assert.match(requestURL,/before=25/);
 app.get('sign-out').onclick();await tick();assert.equal(app.get('visit-log').children.length,0);
});
