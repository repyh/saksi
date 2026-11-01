import type { ReportDraft, SaveReportDraftInput } from "@/contracts/reports/report-draft.contract";

const DATABASE_NAME = "saksi-local-reports";
const DATABASE_VERSION = 1;
const STORE_NAME = "drafts";

function openDraftDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Local report drafts are not available in this browser."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local report drafts."));
    request.onblocked = () => reject(new Error("Local report drafts are blocked by another open tab."));
  });
}

function createDraftId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function saveReportDraft(input: SaveReportDraftInput): Promise<ReportDraft> {
  const database = await openDraftDatabase();
  const now = new Date().toISOString();
  const id = input.id ?? createDraftId();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const existingRequest = store.get(id) as IDBRequest<ReportDraft | undefined>;
    let draft: ReportDraft;
    existingRequest.onsuccess = () => {
      draft = {
        ...input,
        id,
        createdAt: existingRequest.result?.createdAt ?? now,
        updatedAt: now,
      };
      store.put(draft);
    };
    existingRequest.onerror = () => transaction.abort();
    transaction.oncomplete = () => {
      database.close();
      resolve(draft);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not save the report draft."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Saving the report draft was interrupted."));
    };
  });
}

export async function listReportDrafts(): Promise<ReportDraft[]> {
  const database = await openDraftDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll() as IDBRequest<ReportDraft[]>;
    request.onsuccess = () => resolve(request.result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    request.onerror = () => reject(request.error ?? new Error("Could not read local report drafts."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not read local report drafts."));
    };
  });
}

export async function deleteReportDraft(id: string): Promise<void> {
  const database = await openDraftDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not delete the report draft."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Deleting the report draft was interrupted."));
    };
  });
}
