import test from 'node:test';
import assert from 'node:assert/strict';
import {generateInviteToken,parseInviteToken,inviteLink,inviteExpired,inviteIsReusable,inviteValidUntil,INVITE_TTL_MINUTES,INVITE_TTL_MS} from './invites.js';

const stamp = millis => ({seconds:Math.floor(millis/1000),nanoseconds:(millis%1000)*1e6});

test('reusable invitation token is 192-bit random and URL-safe',()=>{
 const a=generateInviteToken(),b=generateInviteToken();
 assert.match(a,/^[0-9a-f]{48}$/);assert.notEqual(a,b);
 assert.equal(INVITE_TTL_MINUTES,60);assert.equal(INVITE_TTL_MS,3600000);
});
test('GitHub Pages URL hash correctly retains invite token',()=>{
 const token='a'.repeat(48);const url=inviteLink(token,'https://nam4eb.github.io');
 assert.equal(url,`https://nam4eb.github.io/sam-JQK/#invite=${token}`);
 assert.equal(parseInviteToken(new URL(url).hash),token);
 assert.equal(parseInviteToken('#/settings'),null);
 assert.equal(parseInviteToken('#invite=bad'),null);
});
test('multi invite is valid for multiple different UIDs within one hour',()=>{
 const start=1000000000000;
 const invite={mode:'multi',createdAt:stamp(start),expiresAt:stamp(start+INVITE_TTL_MS)};
 assert.equal(inviteIsReusable(invite,start),true);
 assert.equal(inviteIsReusable(invite,start+3599999),true);
 assert.equal(inviteIsReusable(invite,start+3600000),false);
 // Validation does not consume or mutate this reusable invite document.
 assert.equal(inviteIsReusable(invite,start+1000),true);
 assert.equal(inviteValidUntil(invite),start+3600000);
});
test('expiry is capped to server creation time + 60 minutes',()=>{
 const start=1000000000000;
 const clockAhead={mode:'multi',createdAt:stamp(start),expiresAt:stamp(start+3600500)};
 assert.equal(inviteValidUntil(clockAhead),start+3600000);
 assert.equal(inviteIsReusable(clockAhead,start+3600000),false);
});
test('old seven-day single-use invites cannot be silently reactivated',()=>{
 const start=1000000000000;
 assert.equal(inviteIsReusable({createdAt:stamp(start),expiresAt:stamp(start+7*86400000)},start+10),false);
 assert.equal(inviteIsReusable({mode:'multi',createdAt:stamp(start),expiresAt:stamp(start+3600000),claimedBy:'uid'},start+10),false);
 assert.equal(inviteIsReusable({mode:'multi',createdAt:stamp(start),expiresAt:stamp(start-1000)},start),false);
 assert.equal(inviteIsReusable({mode:'multi',expiresAt:stamp(start+3600000)},start),false);
});
test('Firestore timestamp and token input validation',()=>{
 assert.equal(inviteExpired({seconds:1000},999000),false);
 assert.equal(inviteExpired({seconds:1000},1000000),true);
 assert.equal(inviteExpired(null),true);
 assert.throws(()=>inviteLink('bad','https://nam4eb.github.io'));
 assert.throws(()=>generateInviteToken({}));
});
