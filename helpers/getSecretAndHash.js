const crypto = require('crypto');
const RIPEMD160 = require('ripemd160');

const validSecret = crypto.randomBytes(32);
const dealId = '0x' + new RIPEMD160().update(crypto.createHash('sha256').update(validSecret).digest()).digest('hex');

console.log(`secret: ${ '0x' + validSecret.toString('hex') }`);
console.log(`dealId: ${ dealId }`);
