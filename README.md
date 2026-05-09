# Дархан-Ус Суваг — Засварын Менежментийн Систем

Дархан-Ус Суваг ХК-ийн ус түгээх байрны засвар үйлчилгээг удирдах веб систем.

Иргэд гомдол илгээх, диспетчер дуудлага хуваарилах, инженер болон бригад ажлаа бүртгэх боломжтой.

---

## Технологи

| Хэсэг | Технологи |
|-------|-----------|
| Frontend | Vanilla HTML, CSS, JavaScript (ES Modules) |
| Backend | Node.js, Express.js, TypeScript |
| Database | PostgreSQL |
| Auth | JWT (JSON Web Token) |
| Аюулгүй байдал | helmet, express-rate-limit, bcrypt, pg advisory lock |
| Docker | Multi-stage build (node:20-alpine) |

---

## Хавтасны бүтэц

```
darkhan-us-suvag-repair-app/
├── frontend/                    # Вэб хуудсууд
│   ├── index.html               # Нүүр хуудас (нийтийн)
│   ├── stations.html            # Ус түгээх байрны жагсаалт
│   ├── station.html             # Байрны дэлгэрэнгүй
│   ├── complaint.html           # Гомдол илгээх хуудас
│   ├── profile-setup.html       # Анхны нэвтрэлтийн профайл тохируулах
│   ├── dispatcher.html          # Диспетчерийн хяналтын самбар
│   ├── engineer.html            # Инженерийн хяналтын самбар
│   ├── brigade.html             # Бригадын ахлагчийн хуудас
│   ├── admin.html               # Админ удирдлагын хуудас
│   ├── reports.html             # Тайлан
│   └── assets/
│       ├── css/style.css        # Бүх хуудсын загвар
│       └── js/
│           ├── api.js           # Backend API дуудлагууд
│           ├── auth.js          # Нэвтрэлт, JWT хадгалалт
│           ├── utils.js         # Туслах функцүүд
│           ├── seed.js          # Тогтмол утгууд (статус, төрөл гэх мэт)
│           ├── sidebar.js       # Хуваалцсан sidebar setup
│           └── pages/           # Хуудас бүрийн JS файлууд
├── backend/
│   ├── src/
│   │   ├── server.ts            # Серверийн эхлэл
│   │   ├── app.ts               # Express тохиргоо, route бүртгэл
│   │   ├── db.ts                # PostgreSQL холболт
│   │   ├── middleware/
│   │   │   └── auth.middleware.ts   # JWT шалгалт
│   │   └── routes/
│   │       ├── auth.routes.ts       # Нэвтрэх /api/auth
│   │       ├── station.routes.ts    # Байрны мэдээлэл /api/stations
│   │       ├── ticket.routes.ts     # Дуудлага /api/tickets
│   │       ├── task.routes.ts       # Ажлын төлөвлөгөө /api/tasks
│   │       ├── complaint.routes.ts  # Гомдол /api/complaints
│   │       ├── report.routes.ts     # Тайлан /api/reports
│   │       ├── meta.routes.ts       # Алба, бригад, хэрэглэгч /api/meta
│   │       └── admin.routes.ts      # Админ CRUD /api/admin
│   └── database/
│       ├── schema.sql           # Хүснэгтүүд болон индексүүд
│       └── seed.sql             # Туршилтын өгөгдөл (schema.sql-ийн дараа ажиллуулна)
```

---

## API Endpoints

| Method | URL | Тайлбар |
|--------|-----|---------|
| POST | `/api/auth/login` | Нэвтрэх |
| GET | `/api/auth/me` | Нэвтэрсэн хэрэглэгчийн мэдээлэл |
| PATCH | `/api/auth/setup-profile` | Анхны нэвтрэлтийн профайл тохируулах |
| GET | `/api/stations` | Байрны жагсаалт (нийтийн) |
| GET | `/api/stations/:id` | Байрны дэлгэрэнгүй |
| GET | `/api/tickets` | Дуудлагын жагсаалт |
| POST | `/api/tickets` | Шинэ дуудлага үүсгэх |
| PATCH | `/api/tickets/:id/assign` | Дуудлага хуваарилах |
| PATCH | `/api/tickets/:id/start` | Ажил эхлэх |
| PATCH | `/api/tickets/:id/finish` | Ажил дуусгах |
| GET | `/api/tasks` | Төлөвлөгөөт ажлын жагсаалт |
| POST | `/api/tasks` | Шинэ ажил үүсгэх |
| POST | `/api/complaints` | Гомдол илгээх |
| GET | `/api/meta` | Алба, бригад, хэрэглэгч (нэвтэрсэн) |
| GET | `/api/reports` | Тайлан |
| GET | `/api/admin/meta` | Админ мета өгөгдөл |
| GET | `/api/admin/archive` | Архивласан бичлэгүүд |
| GET | `/api/admin/audit-logs` | Үйлдлийн лог (сүүлийн 500) |
| POST | `/api/admin/departments` | Алба үүсгэх/шинэчлэх |
| PUT | `/api/admin/departments/:id` | Алба засварлах |
| DELETE | `/api/admin/departments/:id` | Алба архивлах |
| POST | `/api/admin/departments/:id/restore` | Алба сэргээх |
| POST | `/api/admin/teams` | Бригад үүсгэх/шинэчлэх |
| PUT | `/api/admin/teams/:id` | Бригад засварлах |
| DELETE | `/api/admin/teams/:id` | Бригад архивлах |
| POST | `/api/admin/teams/:id/restore` | Бригад сэргээх |
| POST | `/api/admin/users` | Хэрэглэгч үүсгэх |
| PUT | `/api/admin/users/:id` | Хэрэглэгч засварлах |
| DELETE | `/api/admin/users/:id` | Хэрэглэгч архивлах |
| POST | `/api/admin/users/:id/restore` | Хэрэглэгч сэргээх |
| POST | `/api/admin/stations` | Байр үүсгэх/шинэчлэх |
| PUT | `/api/admin/stations/:id` | Байр засварлах |
| DELETE | `/api/admin/stations/:id` | Байр архивлах |
| POST | `/api/admin/stations/:id/restore` | Байр сэргээх |

---

## Хэрэглэгчийн үүргүүд

| Username | Нууц үг | Үүрэг |
|----------|---------|-------|
| admin | admin123 | Систем админ — бүх тохиргоо |
| dispatcher | dispatch123 | Диспетчер — дуудлага хүлээн авах, хуваарилах |
| chief | chief123 | Ерөнхий инженер — бүх ажлыг хянах |
| eng1 | eng123 | Хэлтсийн инженер — өөрийн хэлтсийн ажил |
| bat | bat123 | Бригадын ахлагч — бригадын ажил |
| dorj | dorj123 | Бригадын ахлагч |
| oyun | oyun123 | Бригадын ахлагч |

---

## Анхны нэвтрэлтийн урсгал

Admin шинэ хэрэглэгч үүсгэхэд тухайн хэрэглэгч анх нэвтрэхдээ профайл тохируулах хуудас руу автоматаар шилждэг.

```
Admin → шинэ хэрэглэгч үүсгэнэ
  ↓
Хэрэглэгч нэвтрэнэ (admin өгсөн нууц үгээр)
  ↓
/profile-setup.html руу автоматаар шилжинэ
  ↓
И-мэйл, утас, шинэ нууц үг оруулна
  ↓
Өөрийн dashboard руу орно
```

---

## Архивлалт ба үйлдлийн лог

Устгах үйлдэл нь бодитоор устгалгүй `deleted_at` timestamp тавьж архивладаг.

- **Архив таб** — архивласан бичлэгүүдийг харах, "Сэргээх" дарж буцаах
- **Үйлдлийн лог таб** — админы бүх үүсгэх/засварлах/архивлах/сэргээх үйлдлийг бүртгэдэг

---

## Суулгаж ажиллуулах

### 1. PostgreSQL database үүсгэх

```sql
CREATE DATABASE darkhan_us_suvag;
```

### 2. Схем болон өгөгдөл оруулах

```bash
psql -U postgres -d darkhan_us_suvag -f backend/database/schema.sql
psql -U postgres -d darkhan_us_suvag -f backend/database/seed.sql
```

### 3. Backend тохиргоо

`backend/.env.example`-ийг хуулж `backend/.env` болгон нэрийг өөрчилж, утгуудыг бөглөнө:

```bash
cp backend/.env.example backend/.env
```

```env
PORT=4000
DATABASE_URL=postgresql://postgres:НУУЦ_ҮГ@localhost:5432/darkhan_us_suvag
JWT_SECRET=өөрийн_урт_нууц_түлхүүр
ALLOWED_ORIGINS=http://localhost:3000
```

### 4. Backend суулгаж эхлүүлэх

```bash
cd backend
npm install
npm run build
node dist/server.js
```

Сервер `http://localhost:4000` дээр ажиллана.

### 5. Docker ашиглах (сонголтоор)

```bash
cd backend
docker build -t darkhan-us-suvag-backend .
docker run -p 4000:4000 --env-file .env darkhan-us-suvag-backend
```

### 6. Хөтчөөс нээх

```
http://localhost:4000
```

---

## Өгөгдлийн сан

| Хүснэгт | Тайлбар |
|---------|---------|
| `departments` | 4 алба (`deleted_at` архивлалттай) |
| `teams` | 3 засварын бригад (`deleted_at` архивлалттай) |
| `users` | Дотоод хэрэглэгчид (`email`, `phone`, `profile_complete`, `deleted_at` талбартай) |
| `water_stations` | 330 ус түгээх байр (15 баг × 22 байр, `deleted_at` архивлалттай) |
| `complaints` | Иргэдийн гомдлын бүртгэл |
| `tickets` | Дуудлагын бүртгэл |
| `ticket_logs` | Дуудлага бүрийн үйл явдлын лог |
| `ticket_workers` | Ажилд оролцсон ажилчид |
| `tasks` | Төлөвлөгөөт ажлын бүртгэл |
| `maintenance_logs` | Засварын ажлын дүгнэлт (ticket/task дуусахад үүсдэг) |
| `admin_audit_logs` | Админы бүх үйлдлийн лог (үүсгэх, засах, архивлах, сэргээх) |

---

## Бүрэн SQL схем

```sql
-- Darkhan-Us Suvag Water Station Maintenance System
-- PostgreSQL Schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  department_id VARCHAR(100) REFERENCES departments(id) ON DELETE SET NULL,
  leader_user_id VARCHAR(100),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(100) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin','dispatcher','general_engineer','department_engineer','brigade_leader')),
  department_id VARCHAR(100) REFERENCES departments(id) ON DELETE SET NULL,
  team_id VARCHAR(100) REFERENCES teams(id) ON DELETE SET NULL,
  phone VARCHAR(30),
  email VARCHAR(255),
  profile_complete BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- Water stations
CREATE TABLE IF NOT EXISTS water_stations (
  id VARCHAR(100) PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) DEFAULT '',
  bag_no INTEGER NOT NULL,
  location TEXT DEFAULT '',
  caretaker_name VARCHAR(255) DEFAULT '',
  caretaker_phone VARCHAR(30) DEFAULT '',
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- Complaints
CREATE TABLE IF NOT EXISTS complaints (
  id VARCHAR(100) PRIMARY KEY,
  station_id VARCHAR(100) REFERENCES water_stations(id) ON DELETE SET NULL,
  issue_type VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  citizen_name VARCHAR(255) DEFAULT '',
  phone_number VARCHAR(30) DEFAULT '',
  source VARCHAR(10) NOT NULL CHECK (source IN ('web','phone')),
  photo_name VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new','converted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_label VARCHAR(255) DEFAULT ''
);

-- Tickets
CREATE TABLE IF NOT EXISTS tickets (
  id VARCHAR(100) PRIMARY KEY,
  complaint_id VARCHAR(100) REFERENCES complaints(id) ON DELETE SET NULL,
  ticket_no VARCHAR(100) NOT NULL,
  station_id VARCHAR(100) REFERENCES water_stations(id) ON DELETE SET NULL,
  department_id VARCHAR(100) REFERENCES departments(id) ON DELETE SET NULL,
  team_id VARCHAR(100) REFERENCES teams(id) ON DELETE SET NULL,
  issue_type VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','urgent')),
  status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new','assigned','urgent','in_progress','done')),
  source VARCHAR(10) NOT NULL CHECK (source IN ('web','phone')),
  created_by VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
  assigned_by VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

-- Ticket activity logs
CREATE TABLE IF NOT EXISTS ticket_logs (
  id VARCHAR(100) PRIMARY KEY,
  ticket_id VARCHAR(100) REFERENCES tickets(id) ON DELETE CASCADE,
  user_id VARCHAR(100),
  action VARCHAR(255) NOT NULL,
  note TEXT DEFAULT '',
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ticket workers (who participated in a ticket)
CREATE TABLE IF NOT EXISTS ticket_workers (
  id VARCHAR(100) PRIMARY KEY,
  ticket_id VARCHAR(100) REFERENCES tickets(id) ON DELETE CASCADE,
  user_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE
);

-- Scheduled tasks
CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(100) PRIMARY KEY,
  station_id VARCHAR(100) REFERENCES water_stations(id) ON DELETE SET NULL,
  team_id VARCHAR(100) REFERENCES teams(id) ON DELETE SET NULL,
  department_id VARCHAR(100) REFERENCES departments(id) ON DELETE SET NULL,
  created_by VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','in_progress','done')),
  task_date DATE NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  work_report TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin audit logs (every admin create/update/archive/restore action)
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id VARCHAR(100) PRIMARY KEY,
  user_id VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,       -- create | update | archive | restore
  entity_type VARCHAR(50) NOT NULL,  -- department | team | user | station
  entity_id VARCHAR(100),
  entity_name VARCHAR(255) DEFAULT '',
  details TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Maintenance logs (created on ticket/task finish)
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id VARCHAR(100) PRIMARY KEY,
  ticket_id VARCHAR(100) REFERENCES tickets(id) ON DELETE SET NULL,
  task_id VARCHAR(100) REFERENCES tasks(id) ON DELETE SET NULL,
  team_id VARCHAR(100) REFERENCES teams(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  materials_used TEXT DEFAULT '',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_complaints_station   ON complaints(station_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status    ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_tickets_station      ON tickets(station_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status       ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_team         ON tickets(team_id);
CREATE INDEX IF NOT EXISTS idx_tickets_dept         ON tickets(department_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created      ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_team           ON tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_dept           ON tasks(department_id);
CREATE INDEX IF NOT EXISTS idx_tasks_date           ON tasks(task_date);
CREATE INDEX IF NOT EXISTS idx_ticket_logs_ticket   ON ticket_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_ticket   ON maintenance_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_task     ON maintenance_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_water_stations_bag   ON water_stations(bag_no);
CREATE INDEX IF NOT EXISTS idx_water_stations_code  ON water_stations(code);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created   ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user      ON admin_audit_logs(user_id);

-- Migration: run on existing databases to add soft-delete + audit log
ALTER TABLE departments    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE teams          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE users          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE water_stations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
```
