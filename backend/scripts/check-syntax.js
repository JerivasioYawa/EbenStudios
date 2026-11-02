import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
let count = 0;
function check(dir) { for (const entry of readdirSync(dir, {withFileTypes:true})) { const p=join(dir,entry.name); if(entry.isDirectory()) check(p); else if(p.endsWith('.js')) {execFileSync(process.execPath,['--check',p],{stdio:'inherit'});count++;} } }
for (const dir of ['src','scripts','tests']) check(dir);
console.log(`${count} JavaScript files passed syntax checks.`);
