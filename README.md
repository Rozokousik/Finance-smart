# Finace Dashboard

A responsive finance dashboard with local authentication, note-based transaction tracking, sharing workflows, and built-in data visualization.

## Features

- Local login and user creation flow
- Notes-first workspace for organizing transactions
- Create income, expense, savings, and investment entries
- Tagging, file attachments, and interest calculations
- Share notes by code with view/edit approval flow
- Recent transactions, summaries, and chart-based analysis
- Theme support:
  - Light
  - Dark
  - Dark High Contrast
  - Tomorrow Night Blue

## Project Structure

- `index.html`: main app markup
- `styles.css`: UI styling and theme system
- `script.js`: frontend logic, auth flow, notes, transactions, charts
- `server.js`: lightweight Node.js backend and static server
- `data/db.json`: local JSON data store
- `uploads/`: stored file attachments
- `db/schema.sql`: reference schema design
- `docs/api-examples.md`: sample API requests and responses

## Requirements

- Node.js 18 or newer recommended

## Setup

1. Clone the repository.
2. Open a terminal in the project folder.
3. Start the app:

```bash
npm start
```

4. Open your browser at:

```text
http://localhost:3000/
```

## How It Works

### Authentication

- Users are created and stored in browser `localStorage`
- The active session is also stored locally in the browser

### Backend Storage

- Notes, transactions, attachments, access requests, and sharing data are stored in:

```text
data/db.json
```

- Uploaded files are stored in:

```text
uploads/
```

## Sharing Workflow

- A note owner gets a unique note code
- Another user can request access with that code
- The owner can approve:
  - `view`
  - `edit`
- Approved collaborators can appear in the access list for that note

## Running For Your Own Use

If you want to use this project on your own machine:

1. Install Node.js
2. Run `npm start`
3. Open `http://localhost:3000/`
4. Create a user account from the login page
5. Create a note
6. Start adding transactions

## Libraries And Tools

### Runtime Libraries

- Node.js built-in `http`
- Node.js built-in `fs`
- Node.js built-in `path`
- Node.js built-in `crypto`

This project currently does not depend on external npm libraries.

### Frontend Tools

- HTML5
- CSS3
- Vanilla JavaScript
- SVG/CSS-based chart rendering
- Canvas-based chart export for downloaded PNG files

### Backend Tools

- Lightweight custom Node.js server
- JSON-file-based storage
- Static file serving
- Attachment persistence in local filesystem

## Notes

- This project is designed as a local/self-hosted app
- Authentication is frontend-local right now, not production-grade server auth
- Data is stored locally in JSON for simplicity and easy setup
