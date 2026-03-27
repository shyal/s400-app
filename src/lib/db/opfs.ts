const DB_FILENAME = "stronglifts.sqlite";
const IDB_DB_NAME = "stronglifts-sqlite";
const IDB_STORE = "db";
const IDB_KEY = "data";

async function getOpfsRoot(): Promise<FileSystemDirectoryHandle | null> {
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.getDirectory) {
      return await navigator.storage.getDirectory();
    }
  } catch {
    // OPFS not available
  }
  return null;
}

export async function readDatabase(): Promise<Uint8Array | null> {
  // Try OPFS first
  const root = await getOpfsRoot();
  if (root) {
    try {
      const fileHandle = await root.getFileHandle(DB_FILENAME);
      const file = await fileHandle.getFile();
      const buffer = await file.arrayBuffer();
      return new Uint8Array(buffer);
    } catch {
      // File doesn't exist yet
    }
  }

  // Fallback to IDB
  return readFromIdb();
}

export async function writeDatabase(data: Uint8Array): Promise<void> {
  // Try OPFS first
  const root = await getOpfsRoot();
  if (root) {
    try {
      const fileHandle = await root.getFileHandle(DB_FILENAME, {
        create: true,
      });
      const writable = await fileHandle.createWritable();
      await writable.write(data);
      await writable.close();
      return;
    } catch {
      // Fall through to IDB
    }
  }

  // Fallback to IDB
  await writeToIdb(data);
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readFromIdb(): Promise<Uint8Array | null> {
  try {
    const db = await openIdb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function writeToIdb(data: Uint8Array): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const req = tx.objectStore(IDB_STORE).put(data, IDB_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
