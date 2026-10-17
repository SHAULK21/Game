import {db} from 'sdk';
import {atomicDocument} from './atomicDocument.js';

export const nativeStorage = {
  async read(key) {
    return await db.get('SELECT revision,document FROM game_atomic_documents WHERE id=:id', {':id': key});
  },
  async compareAndSwap(key, revision, document) {
    const result = await db.run(`UPDATE game_atomic_documents
      SET document=:document,revision=revision+1
      WHERE id=:id AND revision=:revision RETURNING revision`, {
      ':document': document, ':id': key, ':revision': revision,
    });
    return result.rowsAffected === 1;
  },
};
export const nativeTransactions = atomicDocument(nativeStorage);
