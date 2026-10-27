// Pamięć bota: data/state.json (gałąź `data`, zapisywana przez GitHub Actions po każdym przebiegu).
import path from 'node:path';
import { DATA, readJson, writeJson } from './util.js';

export const STATE_FILE = path.join(DATA, 'state.json');

export function emptyState() {
  return {
    version: 1,
    ownerId: null,
    cursors: { intake: null, log: null },
    buffer: { messages: [], asked: null },
    phones: {},
    currentPhoneId: null,
    weeks: {},
    requests: {},
    drafts: {},
    items: {},
    jobs: [],
    outbox: [],
    notified: {},
    ig: { tokenRefreshedAt: null },
    performance: null,
    preferences: [],
    chat: [],
  };
}

export function loadState(file = STATE_FILE) {
  return { ...emptyState(), ...readJson(file, emptyState()) };
}

export function saveState(state, file = STATE_FILE) {
  writeJson(file, state);
}
