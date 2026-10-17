// Explicitly authorized one-time setup. Never log either credential.
import {execFileSync} from 'node:child_process';
import sodium from 'libsodium-wrappers';
import {resolveToken} from '../node_modules/@tgcloud/cli/src/core/credentials.js';
process.env.TGCLOUD_DEBUG = 'false';
try {
  const raw = execFileSync('git', ['credential', 'fill'], {input: 'protocol=https\nhost=github.com\npath=SHAULK21/Game.git\n\n', encoding: 'utf8', timeout: 60000,
    env: {...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never'}, stdio: ['pipe', 'pipe', 'pipe']});
  const credential = Object.fromEntries(raw.trim().split('\n').map(line => {const n = line.indexOf('='); return [line.slice(0, n), line.slice(n + 1)];}));
  if (!credential.password) throw new Error('GitHub credential unavailable.');
  const api = async (method, resource, body) => {
    const response = await fetch('https://api.github.com/repos/SHAULK21/Game/' + resource, {method,
      headers: {Authorization: 'Bearer ' + credential.password, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? {'Content-Type': 'application/json'} : {})},
      ...(body ? {body: JSON.stringify(body)} : {})});
    if (!response.ok) {const error = new Error('GitHub request rejected.'); error.status = response.status; throw error;}
    return response.status === 204 ? null : response.json();
  };
  await sodium.ready;
  const key = await api('GET', 'actions/secrets/public-key');
  const encrypted = sodium.to_base64(sodium.crypto_box_seal(sodium.from_string(await resolveToken()), sodium.from_base64(key.key, sodium.base64_variants.ORIGINAL)), sodium.base64_variants.ORIGINAL);
  await api('PUT', 'actions/secrets/TGCLOUD_TOKEN', {encrypted_value: encrypted, key_id: key.key_id});
  const enabled = process.argv.includes('--enable');
  const variable = {name: 'TELEGRAM_NOTIFICATIONS_ENABLED', value: enabled ? 'true' : 'false'};
  const vars = await api('GET', 'actions/variables');
  if (vars.variables.some(row => row.name === variable.name)) await api('PATCH', 'actions/variables/' + variable.name, variable);
  else await api('POST', 'actions/variables', variable);
  credential.password = undefined;
  console.log(JSON.stringify({secret: 'TGCLOUD_TOKEN', saved: true, timerEnabled: enabled}));
} catch (error) {console.error('GitHub timer setup failed:', error.status || error.code || error.name || 'UNKNOWN'); process.exitCode = 1;}
