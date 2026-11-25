import {readFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';

const must = [
  'src/App.jsx', 'src/CloudShell.jsx', 'src/cloud.js', 'src/cloud-model.js',
  'src/invites.js', 'src/InviteAdminPanel.jsx', 'src/firebase.js',
  'src/main.jsx', 'firestore.rules', 'FIREBASE_SETUP.md',
  '.github/workflows/deploy.yml', '.env.example'
];
for (const name of must) {
  if (!existsSync(resolve(name))) throw Error('Missing ' + name);
}

const rules = readFileSync('firestore.rules', 'utf8');
if (/allow\s+read\s*,\s*write\s*:\s*if\s+true/.test(rules)) {
  throw Error('Open Firestore access detected');
}
for (const role of ['admin', 'editor', 'viewer', 'member']) {
  if (!rules.includes(`'${role}'`)) throw Error('Missing role ' + role);
}

const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
for (const name of ['FIREBASE_API_KEY','FIREBASE_AUTH_DOMAIN','FIREBASE_PROJECT_ID','FIREBASE_APP_ID']) {
  if (!workflow.includes(`vars.${name}`)) throw Error('Missing GitHub variable ' + name);
}

// v3.2: reusable 1-hour invite. Each UID gets its own immutable claim document.
// v3.1 used getAfter(invitePath(code)), which is no longer applicable.
const inviteGuards = [
  'function inviteIsValid(code)',
  'function validSelfJoin(uid)',
  'function validMemberClaim(code, uid)',
  'getAfter(claimPath(code, uid))',
  'getAfter(accountPath(uid))',
  "duration.value(1, 'h')",
];
for (const guard of inviteGuards) {
  if (!rules.includes(guard)) {
    throw Error('Invite v3.2 security rules missing: ' + guard);
  }
}
if(!rules.includes('activeMemberIds') || !rules.includes('size() <= 100'))throw Error('Rolling session roster security rules missing');
console.log('Preflight OK: Firebase rules, 1-hour multi-invite, rolling session roster, 4 roles, web config and workflow.');
