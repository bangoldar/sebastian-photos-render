import assert from 'node:assert/strict';
const base=process.env.TEST_BASE||'http://127.0.0.1:4179';
const request=(url,opts={})=>fetch(base+url,{...opts,headers:{origin:base,...opts.headers}});
let r=await request('/api/content');assert.equal(r.status,200);let data=await r.json();assert.equal(data.photos.length,76);assert.equal(data.packages.length,6);
assert.equal((await request('/api/admin')).status,401);
assert.equal((await fetch(base+'/api/login',{method:'POST',headers:{origin:'https://example.com','content-type':'application/json'},body:JSON.stringify({password:'local-test-only-password'})})).status,403);
r=await request('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:'local-test-only-password'})});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0];
const auth={cookie};
r=await request('/api/contact',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Local Test',email:'local-test@example.invalid',message:'A local test inquiry',package:'Standard'})});assert.equal(r.status,200);
r=await request('/api/inquiries',{headers:auth});assert.equal(r.status,200);assert.equal((await r.json())[0].message,'A local test inquiry');
let form=new FormData();for(const [k,v] of Object.entries({action:'savePackage',id:'local-test',category:'single',name:'Local test',price:'$1',description:'test',details:'test details',position:'2'}))form.set(k,v);
r=await request('/api/admin',{method:'POST',headers:auth,body:form});assert.equal(r.status,200);data=await (await request('/api/content')).json();assert.ok(data.packages.some(p=>p.id==='local-test'));
form=new FormData();form.set('action','uploadPhoto');form.set('category','Soccer');form.set('alt','Local test image');form.set('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9ZkAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'test.png');
r=await request('/api/admin',{method:'POST',headers:auth,body:form});assert.equal(r.status,200);data=await(await request('/api/content')).json();const photo=data.photos.find(p=>p.alt==='Local test image');assert.ok(photo);assert.equal((await request(photo.objectKey)).status,200);
for(const [action,id] of [['deletePhoto',photo.id],['deletePackage','local-test']]){form=new FormData();form.set('action',action);form.set('id',id);r=await request('/api/admin',{method:'POST',headers:auth,body:form});assert.equal(r.status,200)}
r=await request('/api/logout',{method:'POST',headers:auth});assert.equal(r.status,200);assert.equal((await request('/api/inquiries',{headers:auth})).status,401);
for(const route of ['/','/work/basketball','/packages/single','/contact','/admin'])assert.equal((await request(route)).status,200);
console.log('Local integration passed: routes, auth, same-origin protection, content, package edits, photo upload, inquiry inbox, and logout.');
