import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
test('legacy migrations preserve records, exact cents and foreign keys; checks reject invalid writes',()=>{
 const db=new DatabaseSync(':memory:');
 try {
  const migrations=readdirSync('prisma/migrations').filter(n=>n!=='migration_lock.toml').sort();
  for(const name of migrations.slice(0,3))db.exec(readFileSync(join('prisma/migrations',name,'migration.sql'),'utf8'));
  db.exec(`INSERT INTO User(id,name,email,password) VALUES(1,'Fixture','fixture@example.test','not-a-real-password');
INSERT INTO Product(id,name,price,stock) VALUES(1,'Fixture tee',0.29,5);
INSERT INTO "Order"(id,userId,total,shippingAddress) VALUES(1,1,0.87,'Cape Town');
INSERT INTO OrderItem(id,orderId,productId,quantity,price) VALUES(1,1,1,3,0.29);`);
  for(const name of migrations.slice(3))db.exec(readFileSync(join('prisma/migrations',name,'migration.sql'),'utf8'));
  assert.equal(db.prepare('SELECT totalCents FROM "Order"').get().totalCents,87);
  assert.equal(db.prepare('SELECT unitPriceCents FROM OrderItem').get().unitPriceCents,29);
  assert.equal(db.prepare('SELECT productName FROM OrderItem').get().productName,'Fixture tee');
  assert.equal(db.prepare('SELECT stock FROM Product').get().stock,5);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  for(const sql of ['UPDATE Product SET stock=-1','UPDATE Product SET priceCents=1.5','UPDATE OrderItem SET quantity=0','UPDATE "Order" SET totalCents=-1',`UPDATE "Order" SET status='Unknown'`,'UPDATE "Order" SET userId=999','DELETE FROM Product WHERE id=1'])assert.throws(()=>db.exec(sql));
 } finally {db.close();}
});
