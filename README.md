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
| Аюулгүй байдал | helmet, express-rate-limit, bcrypt |
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
│   ├── login.html               # Нэвтрэх хуудас
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
│       └── schema.sql           # Хүснэгтүүд + анхны өгөгдөл
```

---

## API Endpoints

| Method | URL | Тайлбар |
|--------|-----|---------|
| POST | `/api/auth/login` | Нэвтрэх |
| GET | `/api/auth/me` | Нэвтэрсэн хэрэглэгчийн мэдээлэл |
| PATCH | `/api/auth/setup-profile` | Анхны нэвтрэлтийн профайл тохируулах |
| GET | `/api/stations` | Байрны жагсаалт |
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

`users` хүснэгтэд `profile_complete` болон `email` талбар нэмэгдсэн. Admin үүсгэсэн хэрэглэгч `profile_complete = false` утгатай эхэлнэ.

---

## Суулгаж ажиллуулах

### 1. PostgreSQL database үүсгэх

```sql
CREATE DATABASE darkhan_us_suvag;
```

### 2. Схем болон өгөгдөл оруулах

```bash
psql -U postgres -d darkhan_us_suvag -f backend/database/schema.sql
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
| `water_stations` | 330 ус түгээх байр (15 баг × 22 байр) |
| `users` | Дотоод хэрэглэгчид (email, phone, profile_complete талбартай) |
| `departments` | 4 алба |
| `teams` | 3 засварын бригад |
| `tickets` | Дуудлагын бүртгэл |
| `tasks` | Төлөвлөгөөт ажлын бүртгэл |
| `complaints` | Иргэдийн гомдлын бүртгэл |
