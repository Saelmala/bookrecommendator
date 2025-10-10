const dbUrl = process.env.COUCHDB_URL;
const dbName = process.env.COUCHDB_DATABASE ?? "saved_books";

let resolvedBaseUrl: string | undefined;
let authorizationHeader: string | undefined;

if (dbUrl) {
  try {
    const parsed = new URL(dbUrl);
    const hasCredentials = parsed.username !== "" || parsed.password !== "";

    if (hasCredentials) {
      const username = decodeURIComponent(parsed.username);
      const password = decodeURIComponent(parsed.password);
      const encodedCredentials = Buffer.from(
        `${username}:${password}`,
      ).toString("base64");
      authorizationHeader = `Basic ${encodedCredentials}`;
      parsed.username = "";
      parsed.password = "";
    }

    resolvedBaseUrl = parsed.toString().replace(/\/+$/, "");
  } catch (error) {
    console.warn(
      `Invalid COUCHDB_URL provided. ${error instanceof Error ? error.message : String(error)}`,
    );
    resolvedBaseUrl = dbUrl.replace(/\/+$/, "");
  }
}

if (!resolvedBaseUrl) {
  console.warn(
    "COUCHDB_URL environment variable is not set. Saved books API routes will fail.",
  );
}

const baseHeaders = new Headers({
  "Content-Type": "application/json",
  Accept: "application/json",
});

if (authorizationHeader) {
  baseHeaders.set("Authorization", authorizationHeader);
}

export type CouchDocument<T> = {
  _id: string;
  _rev: string;
} & T;

export async function couchRequest<T>(path: string, init?: RequestInit) {
  if (!resolvedBaseUrl) {
    throw new Error("Missing CouchDB configuration (COUCHDB_URL).");
  }

  const url = `${resolvedBaseUrl}${path}`;
  const headers = new Headers(baseHeaders);

  if (init?.headers) {
    const overrideHeaders = new Headers(init.headers as HeadersInit);
    overrideHeaders.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `CouchDB request failed (${response.status} ${response.statusText}): ${text}`,
    );
  }

  return (await response.json()) as T;
}

export async function createDocument<T extends object>(doc: T) {
  const path = `/${dbName}`;
  return couchRequest<{ id: string; rev: string }>(path, {
    method: "POST",
    body: JSON.stringify(doc),
  });
}

export async function listDocuments<T extends object>() {
  const path = `/${dbName}/_all_docs?include_docs=true`;
  const data = await couchRequest<{
    rows: { id: string; doc: CouchDocument<T> }[];
  }>(path);

  return data.rows
    .map((row) => row.doc)
    .filter(Boolean) as CouchDocument<T>[];
}
