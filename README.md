# Layout Association Management System

> A full-stack **PERN** (PostgreSQL, Express.js, React.js, Node.js) web application for managing residential layout associations — with SOS emergency alerts, news, voting, complaints, maintenance tracking, and more.

**Powered by JishnuInfotech**

---

## 🏗️ Tech Stack

| Layer      | Technology                                      |
|------------|------------------------------------------------|
| Database   | PostgreSQL 15+                                 |
| Backend    | Node.js 18+, Express.js 4, Socket.io 4        |
| Frontend   | React 18, Vite 5, Tailwind CSS 3, Recharts    |
| Auth       | JWT (access + refresh), bcrypt                 |
| Real-time  | Socket.io (SOS alerts, live voting)            |
| PWA        | Service Worker, Web Manifest                   |
| i18n       | English + Tamil                                |

---

## 📁 Project Structure

```
Association/
├── client/                     # React Frontend (Vite)
│   ├── public/
│   │   ├── manifest.json       # PWA manifest
│   │   ├── sw.js               # Service worker
│   │   └── icons/              # PWA icons
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/         # DataTable, Modal, FileUpload, AudioPlayer, etc.
│   │   │   └── layout/         # Header, Footer, Sidebar, DashboardLayout, FloatingSOS
│   │   ├── context/            # AuthContext, SocketContext, LanguageContext
│   │   ├── hooks/              # useAuth, useSOS
│   │   ├── i18n/               # en.json, ta.json (100+ keys)
│   │   ├── pages/
│   │   │   ├── auth/           # Login, Register, ForgotPassword, ResetPassword
│   │   │   ├── super-admin/    # Dashboard, Associations, PendingApprovals, ManageUsers, SOSReports, AuditLog
│   │   │   ├── admin/          # Dashboard, Members, SOSContacts, SOSAlerts, News, Voting, Complaints, Maintenance, Events, Documents
│   │   │   └── member/         # Dashboard, NewsFeed, Voting, Complaints, Profile, Maintenance
│   │   └── services/           # Axios API service with interceptors
│   ├── .env.example
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── server/                     # Express Backend
│   ├── src/
│   │   ├── config/             # db.js (PG Pool), env.js, multer.js
│   │   ├── controllers/        # 12 controller files
│   │   ├── middleware/         # auth, roles, validate, errorHandler, rateLimiter
│   │   ├── routes/             # 12 route files + index.js
│   │   ├── services/           # sms, email, socket, cron
│   │   ├── utils/              # generateMemberCode, exportUtils
│   │   ├── schema.sql          # Complete PostgreSQL schema
│   │   ├── seed.sql            # Default Super Admin + sample data
│   │   └── index.js            # Server entry point
│   ├── uploads/                # File upload storage (6 subdirs)
│   ├── .env.example
│   └── package.json
│
└── README.md
```

---

## 🔐 Roles & Permissions

| Feature              | Super Admin | Admin | Member |
|---------------------|-------------|-------|--------|
| Manage Associations  | ✅          | ❌    | ❌     |
| Approve Registrations| ✅          | ❌    | ❌     |
| Manage All Users     | ✅          | ❌    | ❌     |
| Association Switcher | ✅          | ❌    | ❌     |
| Manage Members       | ✅          | ✅    | ❌     |
| Configure SOS Contacts| ✅         | ✅    | ❌     |
| Post News            | ✅          | ✅    | ❌     |
| Create Polls         | ✅          | ✅    | ❌     |
| Manage Complaints    | ✅          | ✅    | ❌     |
| Manage Maintenance   | ✅          | ✅    | ❌     |
| Trigger SOS          | ❌          | ❌    | ✅     |
| Vote in Polls        | ❌          | ❌    | ✅     |
| File Complaints      | ❌          | ❌    | ✅     |
| View News Feed       | ✅          | ✅    | ✅     |
| View Audit Log       | ✅          | ✅    | ❌     |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and npm
- **PostgreSQL** 15+ running locally or remotely
- (Optional) SMTP server for email notifications
- (Optional) SMS provider account (Fast2SMS / Twilio / MSG91)

### 1. Clone & Install

```bash
# Backend
cd server
cp .env.example .env
npm install

# Frontend
cd ../client
cp .env.example .env
npm install
```

### 2. Configure Environment

Edit `server/.env`:
```env
PORT=5000
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/association_db
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key-change-in-production
CLIENT_URL=http://localhost:5173
```

### 3. Set Up Database

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE association_db;"

# Run schema
psql -U postgres -d association_db -f server/src/schema.sql

# Seed default Super Admin
psql -U postgres -d association_db -f server/src/seed.sql
```

### 4. Start Development Servers

```bash
# Terminal 1 — Backend
cd server
npm run dev

# Terminal 2 — Frontend
cd client
npm run dev
```

### 5. Login

Open `http://localhost:5173` and login with:
- **Email**: `superadmin@association.com`
- **Password**: `SuperAdmin@123`

---

## 🆘 SOS Emergency Feature

The SOS system is the centerpiece of this application:

1. **Trigger**: Member presses & holds the SOS button for 3 seconds
2. **Type Selection**: Choose emergency type (Medical, Fire, Theft, Women Safety, Other)
3. **Cancel Window**: 5-second countdown to cancel accidental triggers
4. **Notifications**: SMS sent to 2 association office-bearers + 1 police contact
5. **Real-time**: Socket.io broadcast with siren sound to Admin + contacts
6. **Acknowledgement**: Contacts can acknowledge ("On the way")
7. **Escalation**: Auto-escalate to Admin if no response in 2 minutes
8. **Fallback**: Always-visible "Call Police" and "Call 112" buttons (tel: links)
9. **Test Mode**: Test without notifying police
10. **Reports**: Complete SOS history with response time analytics

---

## 📦 Key Modules

### News
- Admin/SA post announcements with text, voice messages, images, attachments
- Categories: Urgent, Meeting, Maintenance, General
- Voice recording via MediaRecorder API + audio playback
- Pin important posts

### Voting
- Admin creates polls with vendors (name, company, quotation, documents)
- Members vote once per poll (enforced by unique constraint)
- Live results via Socket.io + Recharts bar charts
- Auto-close expired polls (node-cron)
- Winner highlighting + Excel export

### Complaints
- Members file complaints with attachments
- Admin tracks status: Open → In Progress → Resolved → Closed
- Priority levels: Low, Medium, High, Urgent

### Maintenance Fees
- Admin creates fee records (single or bulk)
- Track paid/due/overdue status
- Payment reference recording

### Events Calendar
- Calendar + list views
- Admin creates events with date ranges

### Document Library
- Upload, download, organize association documents
- File type icons and metadata

---

## 🔒 Security

- **Helmet** — HTTP security headers
- **CORS** — Configured for frontend origin only
- **Rate Limiting** — General (100/15min), Auth (10/15min), SOS (3/5min)
- **Input Validation** — express-validator on all endpoints
- **Parameterized SQL** — No SQL injection vectors
- **File Validation** — Type + size checks via Multer
- **JWT Rotation** — Short-lived access + long-lived refresh tokens
- **Association Isolation** — Strict per-association data boundaries
- **Audit Log** — All approvals, edits, and deletions tracked

---

## 🌐 PWA Support

The app is installable as a Progressive Web App:
- Service worker with cache-first strategy for static assets
- Network-first for API calls with offline fallback
- Web manifest for home screen installation
- Optimized for mobile-first usage

---

## 📤 Exports

- **Excel**: Members list, vote results (via exceljs)
- **PDF**: Members list (via pdfkit)
- Available from Admin and Super Admin dashboards

---

## 🌏 Internationalization

Toggle between **English** and **Tamil** (தமிழ்):
- 100+ translation keys covering all modules
- Persistent language preference in localStorage
- Toggle available in header

---

## 🚢 Deployment Notes

### Environment Variables (Production)
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/association_db?ssl=true
JWT_SECRET=<strong-random-64-char-string>
JWT_REFRESH_SECRET=<strong-random-64-char-string>
CLIENT_URL=https://yourdomain.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=app-password
SMS_PROVIDER=fast2sms
SMS_API_KEY=your-api-key
```

### Build Frontend
```bash
cd client
npm run build
# Serve dist/ via Nginx or Express static
```

### Process Manager
```bash
npm install -g pm2
cd server
pm2 start src/index.js --name association-api
```

### Nginx Reverse Proxy
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        root /path/to/client/dist;
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 📝 Default Credentials

| Role        | Email                        | Password         |
|-------------|------------------------------|------------------|
| Super Admin | superadmin@association.com   | SuperAdmin@123   |

> ⚠️ **Change the default password immediately after first login in production!**

---

## 📄 License

Built by **JishnuInfotech**. All rights reserved.
