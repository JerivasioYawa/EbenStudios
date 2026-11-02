import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRegistration,validateOrder,validateProduct,validateId} from '../src/lib/validation.js';
test('registration normalizes email and rejects weak passwords and malformed accounts',()=>{
 const result=validateRegistration({name:' Tester ',email:'TEST@EXAMPLE.TEST',password:'twelve-characters'});
 assert.equal(result.email,'test@example.test');
 for(const password of ['x','', '😀'.repeat(40)])assert.throws(()=>validateRegistration({name:'T',email:'t@example.test',password}));
 assert.throws(()=>validateRegistration({name:'T',email:'not-email',password:'twelve-characters'}));
});
test('order combines duplicate lines and rejects invalid quantities and blank addresses',()=>{
 assert.deepEqual(validateOrder({items:[{productId:1,quantity:2},{productId:1,quantity:3}],shippingAddress:' Cape Town '}).items,[{productId:1,quantity:5}]);
 for(const quantity of [0,-1,1.1,101,true])assert.throws(()=>validateOrder({items:[{productId:1,quantity}],shippingAddress:'Cape Town'}));
 assert.throws(()=>validateOrder({items:[{productId:1,quantity:1}],shippingAddress:' '}));
});
test('partial product update supports clearing optional text and rejects invalid IDs',()=>{
 assert.deepEqual(validateProduct({description:'',tag:''},{partial:true}),{description:null,tag:null});
 for(const id of [0,-1,'1x',1.5,true])assert.throws(()=>validateId(id));
});
