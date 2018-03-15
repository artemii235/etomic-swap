const crypto = require('crypto');
const RIPEMD160 = require('ripemd160');

const secret1 = new Buffer('42d928cb29f2b9c09076a7888427b8c9d401b95fb1bfcea5d83d9912528f4f73', 'hex');
const hash1 = '0x' + new RIPEMD160().update(crypto.createHash('sha256').update(secret1).digest()).digest('hex');
const hash256 = '0x' + crypto.createHash('sha256').update(secret1).digest('hex');
const secret2 = crypto.randomBytes(32);
const hash2 = '0x' + new RIPEMD160().update(crypto.createHash('sha256').update(secret2).digest()).digest('hex');

console.log(`secret1: ${ '0x' + secret1.toString('hex') }`);
console.log(`hash1: ${ hash1 }`);
console.log(`hash256: ${ hash256 }`);
console.log(`secret2: ${ '0x' + secret2.toString('hex') }`);
console.log(`hash2: ${ hash2 }`);
console.log(`dealId: ${ '0x' + crypto.randomBytes(32).toString('hex') }`);
