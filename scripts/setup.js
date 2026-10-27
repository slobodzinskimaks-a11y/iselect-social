// Konfiguracja jednym poleceniem (po uzupełnieniu .env):
//   npm run setup            – sprawdza klucze, tworzy kanały Discord, repozytorium GitHub, sekrety, stronę i uruchamia bota
//   npm run setup -- --check – tylko sprawdza klucze (nic nie zmienia)
//   npm run setup -- --code  – tylko wgrywa nowszą wersję kodu do repozytorium (+ --secrets: aktualizuje też klucze z .env)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sodium from 'libsodium-wrappers';
import { config, env } from '../src/config.js';
import * as discord from '../src/discord.js';
import { emptyState } from '../src/state.js';
import { ROOT, writeJson } from '../src/util.js';

const args = new Set(process.argv.slice(2));
const CHECK = args.has('--check');
const CODE_ONLY = args.has('--code');
const ENV_FILE = path.join(ROOT, '.env');
const GH = process.env.GITHUB_TOKEN;
const REPO_NAME = process.env.GITHUB_REPO || 'iselect-social';

const ok = (m) => console.log(`  ✅ ${m}`);
const info = (m) => console.log(`  • ${m}`);
const fail = (m) => { console.error(`\n❌ ${m}\n`); process.exit(1); };

function setEnvValue(key, value) {
  let text = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
  const re = new RegExp(`^${key}=.*$`, 'm');
  text = re.test(text) ? text.replace(re, `${key}=${value}`) : `${text.trimEnd()}\n${key}=${value}\n`;
  fs.writeFileSync(ENV_FILE, text);
  process.env[key] = value;
}

function saveConfig(patch) {
  const file = path.join(ROOT, 'config.json');
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  Object.assign(cfg, patch);
  Object.assign(config, patch);
  writeJson(file, cfg);
}

async function gh(method, route, body) {
  const res = await fetch(`https://api.github.com${route}`, {
    method,
    headers: { Authorization: `Bearer ${GH}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'iselect-setup' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404 && method === 'GET') return null;
  const text = await res.text();
  if (!res.ok) throw new Error(`GitHub ${method} ${route}: ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

// ---------------- Gemini ----------------
async function checkGemini() {
  console.log('\n1) Gemini');
  if (!env.GEMINI_API_KEY) {
    const olx = [path.join(ROOT, '..', 'olx-iphone-hunter', '.env'), path.join(os.homedir(), 'olx-iphone-hunter', '.env')].find((f) => fs.existsSync(f));
    const m = olx && fs.readFileSync(olx, 'utf8').match(/^GEMINI_API_KEY=(.+)$/m);
    if (!m) fail('Brak GEMINI_API_KEY w .env (darmowy klucz: https://aistudio.google.com/apikey).');
    env.GEMINI_API_KEY = m[1].trim();
    if (!CHECK) setEnvValue('GEMINI_API_KEY', env.GEMINI_API_KEY);
    info('Używam klucza z projektu olx-iphone-hunter');
  }
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': env.GEMINI_API_KEY } });
  if (!res.ok) fail(`Klucz Gemini nie działa: ${res.status}`);
  const names = new Set((await res.json()).models.map((m) => m.name.replace('models/', '')));
  const available = config.GEMINI_MODELS.filter((m) => names.has(m));
  if (!available.length) {
    const flash = [...names].filter((n) => /flash/.test(n) && !/image|tts|audio|live|embedding/.test(n)).sort().reverse().slice(0, 3);
    if (!flash.length) fail('Nie znalazłem modelu Gemini Flash.');
    if (!CHECK) saveConfig({ GEMINI_MODELS: flash });
    info(`Ustawiłem modele: ${flash.join(', ')}`);
  } else {
    ok(`Modele: ${available.join(', ')}`);
    if (!CHECK && available.length !== config.GEMINI_MODELS.length) saveConfig({ GEMINI_MODELS: available });
  }
}

// ---------------- Discord ----------------
async function setupDiscord() {
  console.log('\n2) Discord');
  if (!env.DISCORD_BOT_TOKEN) fail('Brak DISCORD_BOT_TOKEN w .env (README → „Discord”).');
  const me = await discord.me().catch((e) => fail(`Token bota nie działa: ${e.message}`));
  ok(`Bot: ${me.username}`);
  const guilds = await discord.myGuilds();
  if (!guilds.length) fail(`Bot nie jest na żadnym serwerze. Zaproś go: https://discord.com/oauth2/authorize?client_id=${me.id}&scope=bot&permissions=536988752`);
  const guild = guilds.find((g) => g.id === process.env.DISCORD_GUILD_ID) ?? guilds[0];
  ok(`Serwer: ${guild.name}${guilds.length > 1 ? ' (inny? ustaw DISCORD_GUILD_ID w .env)' : ''}`);
  const channels = await discord.guildChannels(guild.id);
  const ids = {};
  const topics = {
    intake: 'Tu wysyłasz dane i zdjęcia telefonu. Bot prosi o nie w każdą niedzielę.',
    publish: 'O 21:00 bot wrzuca tu rolki do publikacji z muzyką i potwierdzenia publikacji.',
    log: 'Techniczny: decyzje ze strony akceptacji. Można wyciszyć.',
  };
  for (const [key, name] of Object.entries(config.CHANNELS)) {
    let ch = channels.find((c) => c.type === 0 && c.name === name);
    if (!ch) {
      if (CHECK) { info(`Brak kanału #${name} (zostanie utworzony)`); continue; }
      ch = await discord.createChannel(guild.id, name, topics[key]).catch((e) => fail(`Nie mogę utworzyć #${name} – daj botowi uprawnienie „Zarządzanie kanałami” albo utwórz kanał ręcznie. (${e.message})`));
      info(`Utworzyłem #${name}`);
    }
    ids[key] = ch.id;
  }
  if (CHECK) return;
  saveConfig({ CHANNEL_IDS: ids });
  ok('Kanały: ' + Object.values(config.CHANNELS).map((n) => `#${n}`).join(', '));
  if (!env.REVIEW_WEBHOOK_URL) {
    const existing = (await discord.channelWebhooks(ids.log)).find((w) => w.name === 'Strona akceptacji' && w.token);
    const hook = existing ?? await discord.createWebhook(ids.log, 'Strona akceptacji').catch((e) => fail(`Nie mogę utworzyć webhooka – daj botowi uprawnienie „Zarządzanie webhookami”. (${e.message})`));
    setEnvValue('REVIEW_WEBHOOK_URL', `https://discord.com/api/webhooks/${hook.id}/${hook.token}`);
    env.REVIEW_WEBHOOK_URL = process.env.REVIEW_WEBHOOK_URL;
  }
  ok('Webhook strony akceptacji gotowy');
  return { me, guild, ids };
}

// ---------------- Instagram ----------------
async function checkInstagram() {
  console.log('\n3) Instagram');
  if (!env.IG_ACCESS_TOKEN) fail('Brak IG_ACCESS_TOKEN w .env (README → „Instagram”).');
  const res = await fetch(`https://graph.instagram.com/${config.IG_API_VERSION}/me?fields=user_id,username,account_type&access_token=${encodeURIComponent(env.IG_ACCESS_TOKEN)}`);
  const me = await res.json();
  if (!res.ok || me.error) fail(`Token Instagrama nie działa: ${me.error?.message ?? res.status}`);
  if (me.username !== config.IG_USERNAME) info(`Uwaga: token jest dla @${me.username}, a w config.json jest @${config.IG_USERNAME}`);
  ok(`Konto @${me.username} (${me.account_type ?? 'firmowe/twórcy'})`);
  const lim = await fetch(`https://graph.instagram.com/${config.IG_API_VERSION}/${me.user_id}/content_publishing_limit?access_token=${encodeURIComponent(env.IG_ACCESS_TOKEN)}`).then((r) => r.json());
  if (lim.error) fail(`Brak uprawnienia do publikowania (instagram_business_content_publish): ${lim.error.message}`);
  ok('Uprawnienie do publikowania: jest');
  if (!CHECK) setEnvValue('IG_USER_ID', String(me.user_id));
}

// ---------------- GitHub ----------------
const SKIP = [/^node_modules\//, /^\.env$/, /^\.work\//, /^_preview\//, /^_site\//, /^data\//, /^\.git\//, /^\.claude\//, /^\.new_ig_token$/];

function listFiles(dir = ROOT, base = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (SKIP.some((re) => re.test(e.isDirectory() ? `${rel}/` : rel))) continue;
    if (e.isDirectory()) out.push(...listFiles(path.join(dir, e.name), rel));
    else out.push(rel);
  }
  return out;
}

async function commitFiles(owner, repo, branch, files, message, { orphan = false } = {}) {
  const tree = [];
  for (const f of files) {
    const blob = await gh('POST', `/repos/${owner}/${repo}/git/blobs`, { content: f.content.toString('base64'), encoding: 'base64' });
    tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const ref = orphan ? null : await gh('GET', `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
  const t = await gh('POST', `/repos/${owner}/${repo}/git/trees`, { tree });
  const commit = await gh('POST', `/repos/${owner}/${repo}/git/commits`, { message, tree: t.sha, parents: ref ? [ref.object.sha] : [] });
  if (ref) await gh('PATCH', `/repos/${owner}/${repo}/git/refs/heads/${branch}`, { sha: commit.sha, force: true });
  else await gh('POST', `/repos/${owner}/${repo}/git/refs`, { ref: `refs/heads/${branch}`, sha: commit.sha });
}

async function setSecret(owner, repo, name, value) {
  await sodium.ready;
  const key = await gh('GET', `/repos/${owner}/${repo}/actions/secrets/public-key`);
  const sealed = sodium.crypto_box_seal(sodium.from_string(value), sodium.from_base64(key.key, sodium.base64_variants.ORIGINAL));
  await gh('PUT', `/repos/${owner}/${repo}/actions/secrets/${name}`, { encrypted_value: sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL), key_id: key.key_id });
}

async function setupGithub(discordInfo) {
  console.log('\n4) GitHub');
  if (!GH) fail('Brak GITHUB_TOKEN w .env (README → „GitHub”).');
  const user = await gh('GET', '/user').catch((e) => fail(`Token GitHub nie działa: ${e.message}`));
  const owner = user.login;
  ok(`Konto: ${owner}`);
  let repo = await gh('GET', `/repos/${owner}/${REPO_NAME}`);
  if (CHECK) { info(repo ? `Repozytorium ${REPO_NAME} istnieje` : `Repozytorium ${REPO_NAME} zostanie utworzone`); return; }
  if (!repo) {
    // publiczne = darmowe, nielimitowane minuty Actions i darmowa strona; klucze są w zaszyfrowanych sekretach
    repo = await gh('POST', '/user/repos', { name: REPO_NAME, private: false, auto_init: true, description: 'Bot social media iSelect' });
    info(`Utworzyłem repozytorium ${owner}/${REPO_NAME}`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  saveConfig({ SITE_URL: `https://${owner}.github.io/${REPO_NAME}/` });
  if (!CODE_ONLY || args.has('--secrets')) {
    for (const name of ['GEMINI_API_KEY', 'DISCORD_BOT_TOKEN', 'REVIEW_WEBHOOK_URL', 'IG_ACCESS_TOKEN', 'IG_USER_ID', 'PEXELS_API_KEY', 'PIXABAY_API_KEY']) {
      if (process.env[name]) await setSecret(owner, REPO_NAME, name, process.env[name]);
    }
    await setSecret(owner, REPO_NAME, 'GH_PAT', GH);
    ok('Sekrety zapisane (zaszyfrowane)');
  }
  const files = listFiles().map((p) => ({ path: p, content: fs.readFileSync(path.join(ROOT, p)) }));
  await commitFiles(owner, REPO_NAME, repo.default_branch ?? 'main', files, 'Bot iSelect – aktualizacja kodu');
  ok(`Kod wgrany (${files.length} plików)`);
  if (CODE_ONLY) return;

  if (!(await gh('GET', `/repos/${owner}/${REPO_NAME}/git/ref/heads/data`))) {
    const state = emptyState();
    for (const key of ['intake', 'log']) state.cursors[key] = (await discord.latestMessageId(config.CHANNEL_IDS[key])) ?? '0';
    await commitFiles(owner, REPO_NAME, 'data', [
      { path: 'state.json', content: Buffer.from(`${JSON.stringify(state, null, 2)}\n`) },
      { path: 'site/drafts/index.json', content: Buffer.from('[]\n') },
    ], 'dane bota', { orphan: true });
    ok('Gałąź z danymi utworzona');
  }
  const pages = await gh('GET', `/repos/${owner}/${REPO_NAME}/pages`);
  if (!pages) await gh('POST', `/repos/${owner}/${REPO_NAME}/pages`, { build_type: 'workflow' });
  else if (pages.build_type !== 'workflow') await gh('PUT', `/repos/${owner}/${REPO_NAME}/pages`, { build_type: 'workflow' });
  ok(`Strona akceptacji: ${config.SITE_URL}`);

  await discord.send(config.CHANNEL_IDS.intake, {
    content: `👋 **Cześć! Jestem botem social media iSelect.**
Co niedzielę o ${config.REQUEST_HOUR}:00 poproszę tutaj o telefon na nowy tydzień. Ty wysyłasz dane i zdjęcia, ja robię rolki, karuzele i relacje, Ty akceptujesz na stronie, a ja publikuję o ${config.PUBLISH_HOUR}:00.
**Możesz zacząć od razu:** wyślij dane telefonu i zdjęcia (wypełnię resztę tego tygodnia) albo napisz \`ogólne\`.
Komendy: \`dalej\` · \`ogólne\` · \`sprzedany\` · \`status\` · \`pomoc\``,
  });
  await gh('POST', `/repos/${owner}/${REPO_NAME}/actions/workflows/bot.yml/dispatches`, { ref: repo.default_branch ?? 'main' })
    .then(() => ok('Bot uruchomiony – kolejne przebiegi co ~10 min'))
    .catch((e) => info(`Uruchom ręcznie: GitHub → Actions → bot → Run workflow (${e.message.slice(0, 120)})`));
  console.log(`\nGotowe! Repozytorium: https://github.com/${owner}/${REPO_NAME}\n`);
}

console.log(CHECK ? 'Sprawdzam konfigurację (bez zmian)…' : 'Konfiguruję bota iSelect…');
await checkGemini();
if (!CODE_ONLY) {
  const d = await setupDiscord();
  await checkInstagram();
  await setupGithub(d);
} else {
  await setupGithub();
}
