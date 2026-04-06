const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const UPLOAD_DIR = path.join(ROOT_DIR, "uploads");
const DB_FILE = path.join(DATA_DIR, "db.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
};

const ALLOWED_TYPES = new Set(["income", "expense", "savings", "investment"]);
const ALLOWED_INTEREST_TYPES = new Set(["simple", "compound", "custom", "none"]);

function ensureStorage() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      notes: [],
      transactions: [],
      tags: [],
      transaction_tags: [],
      attachments: [],
      note_access: [],
      access_requests: [],
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
  }
}

function readDb() {
  const data = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  if (!Array.isArray(data.notes)) data.notes = [];
  if (!Array.isArray(data.transactions)) data.transactions = [];
  if (!Array.isArray(data.tags)) data.tags = [];
  if (!Array.isArray(data.transaction_tags)) data.transaction_tags = [];
  if (!Array.isArray(data.attachments)) data.attachments = [];
  if (!Array.isArray(data.note_access)) data.note_access = [];
  if (!Array.isArray(data.access_requests)) data.access_requests = [];
  let mutated = false;
  data.notes.forEach((note) => {
    if (!note.share_code) {
      note.share_code = createNoteCode();
      mutated = true;
    }
  });
  if (mutated) writeDb(data);
  return data;
}

function writeDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  response.end(JSON.stringify(payload));
}

function sendFile(response, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  response.writeHead(200, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
  });
  fs.createReadStream(filePath).pipe(response);
}

function notFound(response) {
  sendJson(response, 404, { error: "Not found." });
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 20 * 1024 * 1024) {
        reject(new Error("Request payload is too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error("Invalid JSON payload."));
      }
    });
    request.on("error", reject);
  });
}

function slugifyTag(tag) {
  return String(tag || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function createNoteCode() {
  return `NOTE-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function canReadNote(db, noteId, userId) {
  const note = db.notes.find((entry) => entry.id === noteId);
  if (!note) return false;
  if (note.user_id === userId) return true;
  return db.note_access.some((entry) => entry.note_id === noteId && entry.user_id === userId);
}

function canEditNote(db, noteId, userId) {
  const note = db.notes.find((entry) => entry.id === noteId);
  if (!note) return false;
  if (note.user_id === userId) return true;
  return db.note_access.some(
    (entry) => entry.note_id === noteId && entry.user_id === userId && entry.access_type === "edit"
  );
}

function currentAccessEntry(db, noteId, userId) {
  return db.note_access.find((entry) => entry.note_id === noteId && entry.user_id === userId) || null;
}

function calculateReturns({ type, amount, interestType, interestRate }) {
  if (!(type === "savings" || type === "investment")) {
    return { expectedReturn: null, finalAmount: null };
  }

  const rate = Number(interestRate);
  if (!Number.isFinite(rate) || interestType === "none" || interestType === "custom") {
    return { expectedReturn: null, finalAmount: null };
  }

  const normalizedRate = rate / 100;
  if (interestType === "simple") {
    const expectedReturn = amount * normalizedRate;
    return {
      expectedReturn: Number(expectedReturn.toFixed(2)),
      finalAmount: Number((amount + expectedReturn).toFixed(2)),
    };
  }

  const finalAmount = amount * ((1 + normalizedRate) ** 1);
  return {
    expectedReturn: Number((finalAmount - amount).toFixed(2)),
    finalAmount: Number(finalAmount.toFixed(2)),
  };
}

function validateTransactionInput(input) {
  const errors = [];
  const noteId = input.noteId;
  const type = input.type;
  const amount = Number(input.amount);
  const occurredAt = input.occurredAt;
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  const tags = Array.isArray(input.tags) ? input.tags.map(slugifyTag).filter(Boolean) : [];
  const attachments = Array.isArray(input.attachments) ? input.attachments : [];
  const interestType = input.interestType || "none";
  const interestRate = input.interestRate === null || input.interestRate === "" || input.interestRate === undefined
    ? null
    : Number(input.interestRate);
  const customFormula = typeof input.customFormula === "string" ? input.customFormula.trim() : "";

  if (!ALLOWED_TYPES.has(type)) {
    errors.push("Type must be one of income, expense, savings, or investment.");
  }

  if (!noteId) {
    errors.push("Note is required.");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    errors.push("Amount must be a valid number greater than 0.");
  }

  if (!occurredAt || Number.isNaN(new Date(occurredAt).getTime())) {
    errors.push("Date & time must be a valid timestamp.");
  }

  if (!ALLOWED_INTEREST_TYPES.has(interestType)) {
    errors.push("Interest type is invalid.");
  }

  if ((type === "savings" || type === "investment") && (interestType === "simple" || interestType === "compound")) {
    if (!Number.isFinite(interestRate) || interestRate < 0) {
      errors.push("Interest rate is required for simple or compound entries.");
    }
  }

  attachments.forEach((file) => {
    if (!file || typeof file !== "object") {
      errors.push("Attachment payload is invalid.");
      return;
    }

    if (!file.name || !file.contentBase64) {
      errors.push("Attachments must include name and base64 content.");
    }

    if (Number(file.size) > 8 * 1024 * 1024) {
      errors.push(`Attachment ${file.name} exceeds 8 MB.`);
    }
  });

  return {
    errors,
    value: {
      noteId,
      type,
      amount,
      currency: "INR",
      occurredAt: new Date(occurredAt).toISOString(),
      notes,
      tags,
      attachments,
      interestType,
      interestRate,
      customFormula,
    },
  };
}

function saveAttachments(userId, transactionId, attachments) {
  const userDir = path.join(UPLOAD_DIR, userId.replace(/[^a-zA-Z0-9_-]/g, "_"));
  fs.mkdirSync(userDir, { recursive: true });

  return attachments.map((file) => {
    const extension = path.extname(file.name) || "";
    const storedName = `${transactionId}-${crypto.randomUUID()}${extension}`;
    const storedPath = path.join(userDir, storedName);
    fs.writeFileSync(storedPath, Buffer.from(file.contentBase64, "base64"));

    return {
      id: crypto.randomUUID(),
      transaction_id: transactionId,
      user_id: userId,
      original_name: file.name,
      mime_type: file.mimeType || "application/octet-stream",
      size_bytes: Number(file.size) || 0,
      storage_path: path.relative(ROOT_DIR, storedPath).replace(/\\/g, "/"),
      created_at: new Date().toISOString(),
    };
  });
}

function expandTransaction(db, transaction) {
  const note = db.notes.find((entry) => entry.id === transaction.note_id) || null;
  const accessEntry = currentAccessEntry(db, transaction.note_id, transaction.user_id);
  const tagLinks = db.transaction_tags.filter((link) => link.transaction_id === transaction.id);
  const tags = tagLinks
    .map((link) => db.tags.find((tag) => tag.id === link.tag_id))
    .filter(Boolean)
    .map((tag) => ({ id: tag.id, name: tag.name }));
  const attachments = db.attachments
    .filter((attachment) => attachment.transaction_id === transaction.id)
    .map((attachment) => ({
      id: attachment.id,
      name: attachment.original_name,
      mimeType: attachment.mime_type,
      size: attachment.size_bytes,
      path: attachment.storage_path,
    }));

  return {
    ...transaction,
    note,
    creator: {
      user_id: transaction.user_id,
      collaborator_tag: accessEntry?.collaborator_tag || "",
      access_type: note?.user_id === transaction.user_id ? "owner" : (accessEntry?.access_type || null),
    },
    tags,
    attachments,
  };
}

function expandNote(db, note, viewerId) {
  const access = note.user_id === viewerId
    ? "owner"
    : (db.note_access.find((entry) => entry.note_id === note.id && entry.user_id === viewerId)?.access_type || null);
  const accessList = note.user_id === viewerId
    ? db.note_access
      .filter((entry) => entry.note_id === note.id)
      .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
      .map((entry) => ({
        user_id: entry.user_id,
        access_type: entry.access_type,
        collaborator_tag: entry.collaborator_tag || "",
        granted_by: entry.granted_by,
        created_at: entry.created_at,
      }))
    : [];

  return {
    ...note,
    access_type: access,
    transactionCount: db.transactions.filter((transaction) => transaction.note_id === note.id).length,
    access_list: accessList,
  };
}

async function handleCreateTransaction(request, response) {
  const userId = request.headers["x-user-id"];
  if (!userId) {
    sendJson(response, 401, { error: "Missing authenticated user context." });
    return;
  }

  try {
    const input = await parseBody(request);
    const { errors, value } = validateTransactionInput(input);
    if (errors.length) {
      sendJson(response, 422, { error: errors.join(" ") });
      return;
    }

    const db = readDb();
    const note = db.notes.find((entry) => entry.id === value.noteId);
    if (!note || !canEditNote(db, value.noteId, userId)) {
      sendJson(response, 404, { error: "Selected note was not found or you do not have edit access." });
      return;
    }
    const transactionId = crypto.randomUUID();
    const calculated = calculateReturns(value);
    const transaction = {
      id: transactionId,
      user_id: userId,
      note_id: note.id,
      type: value.type,
      amount: Number(value.amount.toFixed(2)),
      currency: "INR",
      occurredAt: value.occurredAt,
      notes: value.notes,
      interest_rate: value.interestRate,
      interest_type: value.interestType,
      custom_formula: value.customFormula,
      calculated,
      createdAt: new Date().toISOString(),
    };

    const tagLinks = value.tags.map((tagName) => {
      let tag = db.tags.find((entry) => entry.name === tagName && entry.user_id === userId);
      if (!tag) {
        tag = {
          id: crypto.randomUUID(),
          user_id: userId,
          name: tagName,
          created_at: new Date().toISOString(),
        };
        db.tags.push(tag);
      }

      return {
        id: crypto.randomUUID(),
        transaction_id: transactionId,
        tag_id: tag.id,
      };
    });

    const attachmentRecords = saveAttachments(userId, transactionId, value.attachments);

    db.transactions.push(transaction);
    db.transaction_tags.push(...tagLinks);
    db.attachments.push(...attachmentRecords);
    writeDb(db);

    sendJson(response, 201, {
      message: "Transaction created successfully.",
      transaction: expandTransaction(db, transaction),
    });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Unable to create transaction." });
  }
}

function handleGetTransactions(request, response) {
  const userId = request.headers["x-user-id"];
  if (!userId) {
    sendJson(response, 401, { error: "Missing authenticated user context." });
    return;
  }

  const db = readDb();
  const transactions = db.transactions
    .filter((transaction) => canReadNote(db, transaction.note_id, userId))
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .map((transaction) => expandTransaction(db, transaction));

  sendJson(response, 200, { transactions });
}

function handleGetTags(request, response) {
  const userId = request.headers["x-user-id"];
  if (!userId) {
    sendJson(response, 401, { error: "Missing authenticated user context." });
    return;
  }

  const db = readDb();
  const tags = db.tags
    .filter((tag) => tag.user_id === userId)
    .map((tag) => tag.name)
    .sort((left, right) => left.localeCompare(right));

  sendJson(response, 200, { tags });
}

async function handleCreateNote(request, response) {
  const userId = request.headers["x-user-id"];
  if (!userId) {
    sendJson(response, 401, { error: "Missing authenticated user context." });
    return;
  }

  try {
    const input = await parseBody(request);
    const title = String(input.title || "").trim();
    const description = String(input.description || "").trim();

    if (!title) {
      sendJson(response, 422, { error: "Note title is required." });
      return;
    }

    const db = readDb();
    const exists = db.notes.find(
      (note) => note.user_id === userId && note.title.toLowerCase() === title.toLowerCase()
    );
    if (exists) {
      sendJson(response, 409, { error: "A note with this title already exists." });
      return;
    }

    const note = {
      id: crypto.randomUUID(),
      user_id: userId,
      title,
      description,
      share_code: createNoteCode(),
      created_at: new Date().toISOString(),
    };

    db.notes.push(note);
    writeDb(db);
    sendJson(response, 201, { note: expandNote(db, note, userId) });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Unable to create note." });
  }
}

function handleGetNotes(request, response) {
  const userId = request.headers["x-user-id"];
  if (!userId) {
    sendJson(response, 401, { error: "Missing authenticated user context." });
    return;
  }

  const db = readDb();
  const notes = db.notes
    .filter((note) => canReadNote(db, note.id, userId))
    .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
    .map((note) => expandNote(db, note, userId));

  sendJson(response, 200, { notes });
}

async function handleCreateAccessRequest(request, response) {
  const userId = request.headers["x-user-id"];
  if (!userId) {
    sendJson(response, 401, { error: "Missing authenticated user context." });
    return;
  }

  try {
    const input = await parseBody(request);
    const code = String(input.code || "").trim().toUpperCase();
    const accessType = input.accessType === "edit" ? "edit" : "view";

    if (!code) {
      sendJson(response, 422, { error: "Note code is required." });
      return;
    }

    const db = readDb();
    const note = db.notes.find((entry) => entry.share_code === code);
    if (!note) {
      sendJson(response, 404, { error: "No note matched this code." });
      return;
    }

    if (note.user_id === userId) {
      sendJson(response, 409, { error: "This is already your note." });
      return;
    }

    const existingAccess = currentAccessEntry(db, note.id, userId);
    if (existingAccess) {
      if (existingAccess.access_type === "edit") {
        sendJson(response, 409, { error: "You already have edit access to this note." });
        return;
      }

      if (existingAccess.access_type === "view" && accessType === "view") {
        sendJson(response, 409, { error: "You already have view access to this note." });
        return;
      }
    }

    const existing = db.access_requests.find(
      (entry) => entry.note_id === note.id && entry.requester_user_id === userId && entry.status === "pending"
    );
    if (existing) {
      sendJson(response, 409, { error: "A request for this note is already pending." });
      return;
    }

    const requestEntry = {
      id: crypto.randomUUID(),
      note_id: note.id,
      note_code: code,
      owner_user_id: note.user_id,
      requester_user_id: userId,
      access_type: accessType,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    db.access_requests.push(requestEntry);
    writeDb(db);
    sendJson(response, 201, {
      message: existingAccess?.access_type === "view" && accessType === "edit"
        ? "Edit access request sent for approval."
        : "Access request sent for approval.",
      request: requestEntry,
    });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Unable to create access request." });
  }
}

function handleGetAccessRequests(request, response) {
  const userId = request.headers["x-user-id"];
  if (!userId) {
    sendJson(response, 401, { error: "Missing authenticated user context." });
    return;
  }

  const db = readDb();
  const requests = db.access_requests
    .filter((entry) => entry.owner_user_id === userId && entry.status === "pending")
    .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
    .map((entry) => {
      const note = db.notes.find((noteEntry) => noteEntry.id === entry.note_id);
      return {
        ...entry,
        note_title: note?.title || "Unknown note",
      };
    });

  sendJson(response, 200, { requests });
}

async function handleAccessDecision(request, response) {
  const userId = request.headers["x-user-id"];
  if (!userId) {
    sendJson(response, 401, { error: "Missing authenticated user context." });
    return;
  }

  try {
    const input = await parseBody(request);
    const requestId = String(input.requestId || "");
    const decision = input.decision === "reject" ? "reject" : "approve";

    const db = readDb();
    const requestEntry = db.access_requests.find((entry) => entry.id === requestId);
    if (!requestEntry || requestEntry.owner_user_id !== userId) {
      sendJson(response, 404, { error: "Access request not found." });
      return;
    }

    if (requestEntry.status !== "pending") {
      sendJson(response, 409, { error: "This request has already been handled." });
      return;
    }

    requestEntry.status = decision === "approve" ? "approved" : "rejected";
    requestEntry.handled_at = new Date().toISOString();

    if (decision === "approve") {
      const exists = db.note_access.find(
        (entry) => entry.note_id === requestEntry.note_id && entry.user_id === requestEntry.requester_user_id
      );
      if (!exists) {
        db.note_access.push({
          id: crypto.randomUUID(),
          note_id: requestEntry.note_id,
          user_id: requestEntry.requester_user_id,
          access_type: requestEntry.access_type,
          collaborator_tag: "",
          granted_by: userId,
          created_at: new Date().toISOString(),
        });
      } else if (exists.access_type !== requestEntry.access_type) {
        exists.access_type = requestEntry.access_type;
        exists.granted_by = userId;
        exists.updated_at = new Date().toISOString();
      }
    }

    writeDb(db);
    sendJson(response, 200, { message: `Request ${requestEntry.status}.` });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Unable to update access request." });
  }
}

async function handleUpdateAccessTag(request, response) {
  const userId = request.headers["x-user-id"];
  if (!userId) {
    sendJson(response, 401, { error: "Missing authenticated user context." });
    return;
  }

  try {
    const input = await parseBody(request);
    const noteId = String(input.noteId || "");
    const targetUserId = String(input.targetUserId || "");
    const collaboratorTag = String(input.collaboratorTag || "").trim().slice(0, 40);

    const db = readDb();
    const note = db.notes.find((entry) => entry.id === noteId);
    if (!note || note.user_id !== userId) {
      sendJson(response, 404, { error: "Note not found for this owner." });
      return;
    }

    const accessEntry = currentAccessEntry(db, noteId, targetUserId);
    if (!accessEntry) {
      sendJson(response, 404, { error: "Collaborator access entry not found." });
      return;
    }

    accessEntry.collaborator_tag = collaboratorTag;
    accessEntry.updated_at = new Date().toISOString();
    writeDb(db);
    sendJson(response, 200, { message: "Collaborator tag updated." });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Unable to update collaborator tag." });
  }
}

function serveStatic(request, response) {
  const requestPath = request.url === "/" ? "/index.html" : request.url;
  const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT_DIR, safePath);

  if (!filePath.startsWith(ROOT_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    notFound(response);
    return;
  }

  sendFile(response, filePath);
}

ensureStorage();

const server = http.createServer((request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, X-User-Id",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    });
    response.end();
    return;
  }

  if (request.method === "POST" && (request.url === "/transactions" || request.url === "/api/transactions")) {
    handleCreateTransaction(request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/api/notes") {
    handleCreateNote(request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/api/access/request") {
    handleCreateAccessRequest(request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/api/access/approve") {
    handleAccessDecision(request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/api/access/tag") {
    handleUpdateAccessTag(request, response);
    return;
  }

  if (request.method === "GET" && request.url === "/api/transactions") {
    handleGetTransactions(request, response);
    return;
  }

  if (request.method === "GET" && request.url === "/api/notes") {
    handleGetNotes(request, response);
    return;
  }

  if (request.method === "GET" && request.url === "/api/access/requests") {
    handleGetAccessRequests(request, response);
    return;
  }

  if (request.method === "GET" && request.url === "/api/tags") {
    handleGetTags(request, response);
    return;
  }

  if (request.method === "GET") {
    serveStatic(request, response);
    return;
  }

  notFound(response);
});

server.listen(PORT, () => {
  console.log(`Finace Dashboard listening on http://localhost:${PORT}`);
});
