# Transactions API

## POST `/api/notes`

Headers:

```http
Content-Type: application/json
X-User-Id: demo-user-01
```

Request:

```json
{
  "title": "April household budget",
  "description": "Groceries, utilities and monthly bills"
}
```

Response:

```json
{
  "note": {
    "id": "note-123",
    "user_id": "demo-user-01",
    "title": "April household budget",
    "description": "Groceries, utilities and monthly bills",
    "created_at": "2026-04-05T18:45:00.000Z",
    "transactionCount": 0
  }
}
```

## POST `/transactions`

Headers:

```http
Content-Type: application/json
X-User-Id: demo-user-01
```

Request:

```json
{
  "noteId": "note-123",
  "type": "investment",
  "amount": 25000,
  "currency": "INR",
  "occurredAt": "2026-04-05T13:45:00.000Z",
  "notes": "Monthly SIP top-up",
  "tags": ["sip", "equity", "long-term"],
  "interestRate": 12,
  "interestType": "compound",
  "customFormula": "",
  "attachments": [
    {
      "name": "statement.pdf",
      "mimeType": "application/pdf",
      "size": 53210,
      "contentBase64": "JVBERi0xLjQKJ..."
    }
  ]
}
```

Response:

```json
{
  "message": "Transaction created successfully.",
  "transaction": {
    "id": "8d64c4fd-c20b-4d0f-9b4c-a53feae95a91",
    "user_id": "demo-user-01",
    "note_id": "note-123",
    "type": "investment",
    "amount": 25000,
    "currency": "INR",
    "occurredAt": "2026-04-05T13:45:00.000Z",
    "notes": "Monthly SIP top-up",
    "interest_rate": 12,
    "interest_type": "compound",
    "custom_formula": "",
    "calculated": {
      "expectedReturn": 3000,
      "finalAmount": 28000
    },
    "createdAt": "2026-04-05T13:45:30.000Z",
    "note": {
      "id": "note-123",
      "title": "April household budget",
      "description": "Groceries, utilities and monthly bills"
    },
    "tags": [
      { "id": "tag-1", "name": "sip" },
      { "id": "tag-2", "name": "equity" }
    ],
    "attachments": [
      {
        "id": "att-1",
        "name": "statement.pdf",
        "mimeType": "application/pdf",
        "size": 53210,
        "path": "uploads/demo-user-01/8d64c4fd-c20b-4d0f-9b4c-a53feae95a91-file.pdf"
      }
    ]
  }
}
```
