import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const temp=mkdtempSync(join(tmpdir(),'eben-test-'));
writeFileSync(join(temp,'test.db'),'');
process.env.DATABASE_URL=`file:${join(temp,'test.db')}`;
process.env.JWT_SECRET=randomUUID()+randomUUID();
process.env.UPLOAD_DIR=join(temp,'uploads');
let server,prisma,base,customer,admin,other;
async function request(path,{method='GET',body,token,key,headers={}}={}) {
 const response=await fetch(base+path,{method,headers:{...(body && !(body instanceof FormData)?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`} : {}),...(key?{'Idempotency-Key':key}:{}),...headers},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});
 const text=await response.text();return {status:response.status,data:text?JSON.parse(text):null,headers:response.headers};
}
async function product(stock=5) {const r=await request('/products',{method:'POST',token:admin,body:{name:randomUUID(),price:'0.29',stock,description:'old',tag:'demo'}});assert.equal(r.status,201);return r.data;}
async function order(p,quantity=1,key=randomUUID(),token=customer){return request('/orders',{method:'POST',token,key,body:{items:[{productId:p.id,quantity}],shippingAddress:'1 Test Road, Cape Town, 8000'}});}
async function status(id,value){return request(`/orders/${id}/status`,{method:'PATCH',token:admin,body:{status:value}});}
before(async()=>{
 execFileSync(process.execPath,[resolve('node_modules/prisma/build/index.js'),'migrate','deploy'],{env:process.env,stdio:'pipe'});
 ({prisma}=await import('../src/lib/prisma.js'));
 const {default:app}=await import('../src/app.js');server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));base=`http://127.0.0.1:${server.address().port}/api`;
 for(const [name,role] of [['customer','CUSTOMER'],['admin','ADMIN'],['other','CUSTOMER']]){
  const r=await request('/auth/register',{method:'POST',body:{name,email:`${name}@example.test`,password:'test-password-long'}});assert.equal(r.status,201);
  if(role==='ADMIN')await prisma.user.update({where:{id:r.data.user.id},data:{role}});
  if(name==='customer')customer=r.data.token;else if(name==='admin')admin=r.data.token;else other=r.data.token;
 }
});
after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));await prisma?.$disconnect();rmSync(temp,{recursive:true,force:true});});
test('HTTP registration rejects invalid credentials, duplicate emails and role escalation',async()=>{
 assert.equal((await request('/auth/register',{method:'POST',body:{name:'X',email:'bad',password:'x'}})).status,400);
 assert.equal((await request('/auth/register',{method:'POST',body:{name:'X',email:'customer@example.test',password:'test-password-long'}})).status,409);
 const r=await request('/auth/register',{method:'POST',body:{name:'X',email:'escalate@example.test',password:'test-password-long',role:'ADMIN'}});assert.equal(r.data.user.role,'CUSTOMER');assert.equal(r.data.user.password,undefined);
 assert.equal((await request('/auth/login',{method:'POST',body:{email:'customer@example.test',password:'wrong'}})).status,401);
 assert.equal((await request('/auth/login',{method:'POST',body:{email:'customer@example.test',password:'test-password-long'}})).status,200);
});
test('HTTP authorization and database-backed role changes are enforced',async()=>{
 assert.equal((await request('/orders')).status,401);assert.equal((await request('/orders',{token:customer})).status,403);
 assert.equal((await request('/products',{method:'POST',token:customer,body:{name:'x',price:1,stock:1}})).status,403);
 assert.equal((await request('/auth/me',{token:customer})).status,200);
});
test('checkout uses cents, replays once and isolates customer history',async()=>{
 const p=await product();const key=randomUUID();const a=await order(p,3,key);assert.equal(a.status,201);assert.equal(a.data.totalCents,87);
 const b=await order(p,3,key);assert.equal(b.status,200);assert.equal(b.data.id,a.data.id);assert.equal((await prisma.product.findUnique({where:{id:p.id}})).stock,2);
 assert.equal((await order(p,2,key)).status,409);assert.equal((await order(p,3,key,other)).status,409);
 assert.ok(!(await request('/orders/mine',{token:other})).data.some(o=>o.id===a.data.id));
});
test('invalid quantities and missing checkout keys cannot mutate stock',async()=>{
 const p=await product();for(const q of [0,-1,1.5,101])assert.equal((await order(p,q)).status,400);
 assert.equal((await request('/orders',{method:'POST',token:customer,body:{items:[{productId:p.id,quantity:1}],shippingAddress:'Cape Town'}})).status,400);
 assert.equal((await prisma.product.findUnique({where:{id:p.id}})).stock,5);
});
test('multi-item checkout rolls back earlier stock deductions',async()=>{
 const a=await product(5),b=await product(0);
 const r=await request('/orders',{method:'POST',token:customer,key:randomUUID(),body:{items:[{productId:a.id,quantity:2},{productId:b.id,quantity:1}],shippingAddress:'Cape Town'}});assert.equal(r.status,409);assert.equal((await prisma.product.findUnique({where:{id:a.id}})).stock,5);
});
test('cancellation restores stock exactly once and final states reject backward transitions',async()=>{
 const p=await product(),o=await order(p,2);assert.equal((await status(o.data.id,'Cancelled')).status,200);assert.equal((await status(o.data.id,'Cancelled')).status,200);assert.equal((await prisma.product.findUnique({where:{id:p.id}})).stock,5);assert.equal((await status(o.data.id,'Paid')).status,409);
 const o2=await order(p);for(const s of ['Paid','Shipped','Delivered'])assert.equal((await status(o2.data.id,s)).status,200);assert.equal((await status(o2.data.id,'Pending')).status,409);
});
test('snapshot survives product rename, archive and restore; optional fields clear',async()=>{
 const p=await product(),o=await order(p);
 const update=await request(`/products/${p.id}`,{method:'PUT',token:admin,body:{name:randomUUID(),price:'9.99',description:'',tag:''}});assert.equal(update.data.description,null);assert.equal(update.data.tag,null);
 assert.equal((await request(`/products/${p.id}`,{method:'DELETE',token:admin})).status,204);assert.equal((await request(`/products/${p.id}`)).status,404);assert.equal((await order(p)).status,409);
 const historic=(await request('/orders/mine',{token:customer})).data.find(x=>x.id===o.data.id);assert.equal(historic.items[0].productName,p.name);assert.equal(historic.items[0].unitPriceCents,29);
 assert.ok((await request('/products/archived',{token:admin})).data.some(x=>x.id===p.id));assert.equal((await request(`/products/${p.id}/restore`,{method:'PATCH',token:admin})).status,200);
});
test('simultaneous buyers cannot oversell one remaining item',async()=>{
 const p=await product(1);const results=await Promise.all([order(p),order(p,1,randomUUID(),other)]);assert.equal(results.filter(r=>r.status===201).length,1);assert.ok(results.every(r=>[201,409].includes(r.status)));assert.equal((await prisma.product.findUnique({where:{id:p.id}})).stock,0);
});
test('uploads reject spoofed and oversized files and clean failed saves',async()=>{
 const initial=readdirSync(process.env.UPLOAD_DIR).length;
 function form(bytes,type='image/png'){const f=new FormData();f.set('name',randomUUID());f.set('price','1');f.set('stock','1');f.set('image',new Blob([bytes],{type}),'untrusted.html');return f;}
 assert.equal((await request('/products',{method:'POST',token:admin,body:form('not a png')})).status,400);
 assert.equal((await request('/products',{method:'POST',token:admin,body:form(Buffer.alloc(5*1024*1024+1))})).status,400);
 assert.equal(readdirSync(process.env.UPLOAD_DIR).length,initial);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=','base64');
 const valid=await request('/products',{method:'POST',token:admin,body:form(png)});assert.equal(valid.status,201);assert.ok(valid.data.imageUrl.endsWith('.png'));
 const bad=form(png);bad.set('price','-1');assert.equal((await request('/products',{method:'POST',token:admin,body:bad})).status,400);assert.equal(readdirSync(process.env.UPLOAD_DIR).length,initial+1);
});
test('CORS only enables configured browser origins',async()=>{
 assert.equal((await request('/health',{headers:{Origin:'http://localhost:5173'}})).headers.get('access-control-allow-origin'),'http://localhost:5173');assert.equal((await request('/health',{headers:{Origin:'https://other.example'}})).headers.get('access-control-allow-origin'),null);
});
