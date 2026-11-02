import 'dotenv/config';
import {mkdirSync,openSync,closeSync,existsSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {PrismaClient} from '@prisma/client';
const url=process.env.DATABASE_URL;
if(!url?.startsWith('file:')) throw new Error('DATABASE_URL must be a SQLite file: URL.');
const database=resolve('prisma',url.slice(5));
mkdirSync(dirname(database),{recursive:true});
if(!existsSync(database)) closeSync(openSync(database,'a'));
const prisma=new PrismaClient();
let oldSchema=false;
try {
 const columns=await prisma.$queryRawUnsafe('PRAGMA table_info("Product")');
 oldSchema=columns.some(column=>column.name==='price');
} finally {await prisma.$disconnect();}
if(oldSchema){
 const backup=`${database}.${Date.now()}.backup`;
 copyFileSync(database,backup);
 console.log(`Legacy database backup created: ${backup}. Stop the API and Studio before this command.`);
 execFileSync(process.execPath,['scripts/phase4-preflight.js'],{stdio:'inherit'});
}
execFileSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{stdio:'inherit'});
if(oldSchema)execFileSync(process.execPath,['scripts/phase4-verify.js'],{stdio:'inherit'});
