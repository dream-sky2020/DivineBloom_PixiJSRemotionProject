import { openDB } from 'idb';
import type { DBSchema } from 'idb';

const DB_NAME = 'new-world-store';
const DB_VERSION = 1;
const STORE_NAME = 'dslDrafts';
const DSL_TO_IMAGE_DRAFT_ID = 'dsl-to-image';

interface DslDraftRecord {
  id: string;
  content: string;
  updatedAt: number;
}

interface NewWorldDB extends DBSchema {
  dslDrafts: {
    key: string;
    value: DslDraftRecord;
  };
}

const dbPromise = openDB<NewWorldDB>(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    }
  },
});

export async function loadDslToImageDraft() {
  const db = await dbPromise;
  const draft = await db.get(STORE_NAME, DSL_TO_IMAGE_DRAFT_ID);
  return draft?.content;
}

export async function saveDslToImageDraft(content: string) {
  const db = await dbPromise;
  await db.put(STORE_NAME, {
    id: DSL_TO_IMAGE_DRAFT_ID,
    content,
    updatedAt: Date.now(),
  });
}
