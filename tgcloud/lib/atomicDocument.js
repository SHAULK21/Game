// JSON-only transaction boundary. All related ownership, balance and receipt
// changes must live in the SAME document and commit in one compare-and-swap.
// The callback must only mutate its private candidate: no DB/API side effects.
const clone = value => JSON.parse(JSON.stringify(value));
export class AtomicConflict extends Error {
  constructor(code) {super(code); this.code = code;}
}

export function atomicDocument(storage, {attempts = 8} = {}) {
  return {
    async update(key, apply) {
      for (let attempt = 0; attempt < attempts; attempt++) {
        const current = await storage.read(key);
        if (!current) throw new AtomicConflict('STATE_NOT_INITIALIZED');
        if (!Number.isSafeInteger(current.revision) || current.revision < 0 || current.revision === Number.MAX_SAFE_INTEGER) throw new AtomicConflict('INVALID_STATE_REVISION');
        // Every storage read is parsed into a fresh private candidate. Keep the
        // original bytes for comparison instead of cloning/stringifying twice.
        const candidate = JSON.parse(current.document);
        const result = await apply(candidate);
        const document = JSON.stringify(candidate);
        if (document === current.document) return result;
        if (await storage.compareAndSwap(key, current.revision, document)) return result;
      }
      throw new AtomicConflict('STATE_BUSY');
    },
    async read(key) {
      const row = await storage.read(key);
      if (!row) throw new AtomicConflict('STATE_NOT_INITIALIZED');
      return {revision: row.revision, state: JSON.parse(row.document)};
    },
    async transact(key, operation, apply) {
      if (!operation || typeof operation.id !== 'string' || !operation.id ||
          typeof operation.fingerprint !== 'string' || !operation.fingerprint) {
        throw new AtomicConflict('INVALID_OPERATION');
      }
      // Receipts are partitioned by verified user identity by the caller.
      const receiptKey = operation.id;
      for (let attempt = 0; attempt < attempts; attempt++) {
        const current = await this.read(key);
        if (!Number.isSafeInteger(current.revision) || current.revision < 0 || current.revision === Number.MAX_SAFE_INTEGER) {
          throw new AtomicConflict('INVALID_STATE_REVISION');
        }
        const receipt = current.state.receipts && Object.hasOwn(current.state.receipts, receiptKey)
          ? current.state.receipts[receiptKey] : null;
        if (receipt) {
          if (receipt.fingerprint !== operation.fingerprint) throw new AtomicConflict('OPERATION_CONFLICT');
          return {result: clone(receipt.result), revision: current.revision, replayed: true};
        }
        const candidate = clone(current.state);
        const result = await apply(candidate);
        candidate.receipts ??= {};
        // Define explicitly so arbitrary receipt strings cannot invoke the
        // legacy __proto__ setter on objects created by application code.
        Object.defineProperty(candidate.receipts, receiptKey, {value: {
          fingerprint: operation.fingerprint, result: result ?? null,
        }, enumerable: true, writable: true, configurable: true});
        const document = JSON.stringify(candidate);
        if (await storage.compareAndSwap(key, current.revision, document)) {
          return {result: clone(result ?? null), revision: current.revision + 1, replayed: false};
        }
      }
      throw new AtomicConflict('STATE_BUSY');
    },
  };
}
