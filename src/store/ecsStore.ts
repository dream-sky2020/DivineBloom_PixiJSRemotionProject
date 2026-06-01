import { openDB } from 'idb';
import type { DBSchema } from 'idb';

const DB_NAME = 'new-world-ecs-store';
const DB_VERSION = 1;
const STORE_NAME = 'ecsConfig';
const LAST_XML_PATH_ID = 'last-xml-path';

interface EcsConfigRecord {
  id: string;
  path: string;
  updatedAt: number;
}

interface EcsDB extends DBSchema {
  ecsConfig: {
    key: string;
    value: EcsConfigRecord;
  };
}

const dbPromise = openDB<EcsDB>(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    }
  },
});

export async function loadLastEcsXmlPath() {
  const db = await dbPromise;
  const record = await db.get(STORE_NAME, LAST_XML_PATH_ID);
  return record?.path;
}

export async function saveLastEcsXmlPath(path: string) {
  const db = await dbPromise;
  await db.put(STORE_NAME, {
    id: LAST_XML_PATH_ID,
    path,
    updatedAt: Date.now(),
  });
}
