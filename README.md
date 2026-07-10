# Valkey E-commerce
E-commerce platform with vector similarity search, sorted sets for price filtering, and JSON documents.

## Local Access
- **Frontend App:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:5000](http://localhost:5000)


## Tech Stack
- Backend: Node.js 20, Express 4, Valkey (Redis)
- Database: Valkey (Redis Stack / Search & JSON)
- Frontend: React 18, Bootstrap

## Prerequisites
- Node.js 20+
- Valkey (with Search and JSON modules enabled)

## Getting Started

### Backend
```bash
cd backend
cp .env.example .env
# fill in .env values (VALKEY_URL=redis://localhost:6379)
npm install
npm run dev
```

### Frontend
```bash
cd frontend
cp .env.example .env
# fill in .env values (VITE_API_URL=http://localhost:5000/api)
npm install
npm run dev
```

## Environment Variables

### Backend
| Variable | Description | Example |
|---|---|---|
| VALKEY_URL | Valkey connection string | redis://localhost:6379 |
| PORT | Server port | 5000 |
| LOG_LEVEL | Logging level | info |
| ALLOWED_ORIGINS | CORS allowed origins | http://localhost:3000 |

### Frontend
| Variable | Description | Example |
|---|---|---|
| VITE_API_URL | API Base URL | http://localhost:5000/api |

## API Endpoints
| Method | Route | Description | Auth |
|---|---|---|---|
| GET | /health | Health check | No |
| GET | /health/valkey | Valkey status | No |
| POST | /api/auth/register | Register | No |
| POST | /api/auth/login | Login | No |
| GET | /api/products | Search products | No |

## Folder Structure
```
valkey/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── schemas/
│   │   ├── utils/
│   │   ├── middlewares/
│   │   ├── app.js
│   │   └── server.js
│   ├── package.json
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   ├── constants/
│   │   └── pages/
│   └── package.json
└── README.md
```
