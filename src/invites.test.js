import test from 'node:test';
import assert from 'node:assert/strict';
import {generateInviteToken, parseInviteToken, inviteLink, inviteExpired} from './invites.js';

test('invite is random 192 bit lowercase hex', () => {
 const a=generateInviteToken(),b=generateInviteToken();
 assert.match(a,/^[0-9a-f]{48}$/);assert.notEqual(a,b);
});
test('invite token round trips in GitHub Pages URL hash',()=>{
 const token='a'.repeat(48);const url=inviteLink(token,'https://nam4eb.github.io');
 assert.equal(url,`https://nam4eb.github.io/sam-JQK/#invite=${token}`);
 assert.equal(parseInviteToken(new URL(url).hash),token);
 assert.equal(parseInviteToken('#/settings'),null);
 assert.equal(parseInviteToken('#invite=bad'),null);
});
test('invite expiry respects Firestore timestamps',()=>{
 assert.equal(inviteExpired({seconds:1000},999000),false);
 assert.equal(inviteExpired({seconds:1000},1000000),true);
 assert.equal(inviteExpired({toMillis:()=>2000},1999),false);
 assert.equal(inviteExpired(null),true);
});
test('reject forged short tokens and missing secure random',()=>{
 assert.throws(()=>inviteLink('bad','https://nam4eb.github.io'));
 assert.throws(()=>generateInviteToken({}));
});
