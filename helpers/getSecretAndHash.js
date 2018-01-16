const crypto = require('crypto');
const RIPEMD160 = require('ripemd160');

const secret1 = crypto.randomBytes(32);
const hash1 = '0x' + new RIPEMD160().update(crypto.createHash('sha256').update(secret1).digest()).digest('hex');
const secret2 = crypto.randomBytes(32);
const hash2 = '0x' + new RIPEMD160().update(crypto.createHash('sha256').update(secret2).digest()).digest('hex');

console.log(`secret1: ${ '0x' + secret1.toString('hex') }`);
console.log(`hash1: ${ hash1 }`);
console.log(`secret2: ${ '0x' + secret2.toString('hex') }`);
console.log(`hash2: ${ hash2 }`);
console.log(`dealId: ${ '0x' + crypto.randomBytes(32).toString('hex') }`);
