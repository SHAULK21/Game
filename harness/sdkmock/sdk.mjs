export const state = {row: null, sent: []};
export const db = {
  async get(sql, p) { return state.row ? {revision: state.row.revision, document: state.row.document} : undefined; },
  async run(sql, p) { if (state.row && state.row.revision === p[':revision']) { state.row = {revision: state.row.revision + 1, document: p[':document']}; return {rowsAffected: 1}; } return {rowsAffected: 0}; },
};
export const api = { async sendMessage(x) { state.sent.push(x); return {}; }, async setChatMenuButton(x) { state.sent.push({menu: x.chat_id}); return true; }, async createInvoiceLink() { return 'https://t.me/$inv'; }, async sendPhoto(x) { state.sent.push({photo: x.photo, chat_id: x.chat_id, caption: x.caption.slice(0, 60)}); return {}; } };
export class EndpointError extends Error {}
