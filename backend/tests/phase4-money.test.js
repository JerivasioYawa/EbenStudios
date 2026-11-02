import test from "node:test";
import assert from "node:assert/strict";
import { randToCents, addLineTotal, centsToRand } from "../src/lib/money.js";
import { presentOrder } from "../src/lib/presenters.js";
import { validateProduct, validateOrder, validateRegistration } from "../src/lib/validation.js";
test("decimal prices become exact integer cents",()=>{
    assert.equal(randToCents("0.29"),29); assert.equal(randToCents("1199.99"),119999);
    assert.equal(randToCents(549),54900); assert.equal(randToCents("0"),0);
});
test("three units at 29 cents totals exactly 87 cents",()=>assert.equal(addLineTotal(0,29,3),87));
test("invalid monetary inputs are rejected",()=>{
    for(const value of [-1,"-1","1.234","",null,true,NaN,Infinity,{},"1000000.01"]) assert.throws(()=>randToCents(value));
});
test("order overflow is rejected",()=>assert.throws(()=>addLineTotal(2147483647,1,1)));
test("product validator exposes only approved database fields",()=>{
    const value=validateProduct({name:" Test ",price:"1.29",stock:"3",isActive:false,priceCents:1});
    assert.deepEqual(value,{name:"Test",priceCents:129,stock:3});
});
test("phase2 quantities and registration minimum remain enforced",()=>{
    assert.throws(()=>validateOrder({items:[{productId:1,quantity:-1}],shippingAddress:"Test"}));
    assert.throws(()=>validateRegistration({name:"Test",email:"a@example.test",password:"short"}));
});
test("order API retains compatible fields and uses stored product name",()=>{
    const out=presentOrder({totalCents:87,items:[{productId:1,productName:"Purchased name",unitPriceCents:29,quantity:3,product:{id:1,name:"Renamed",priceCents:200}}]});
    assert.equal(out.total,0.87);assert.equal(out.items[0].price,0.29);
    assert.equal(out.items[0].product.name,"Purchased name");assert.equal(out.items[0].product.price,2);
    assert.equal(centsToRand(119900),1199);
});
