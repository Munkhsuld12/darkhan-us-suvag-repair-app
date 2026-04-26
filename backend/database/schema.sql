-- Darkhan-Us Suvag Water Station Maintenance System
-- PostgreSQL Schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  department_id VARCHAR(100) REFERENCES departments(id) ON DELETE SET NULL,
  leader_user_id VARCHAR(100)
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
  phone VARCHAR(30)
);

-- Water stations
CREATE TABLE IF NOT EXISTS water_stations (
  id VARCHAR(100) PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) DEFAULT '',
  bag_no INTEGER NOT NULL,
  location TEXT DEFAULT '',
  caretaker_name VARCHAR(255) DEFAULT '',
  caretaker_phone VARCHAR(30) DEFAULT ''
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_complaints_station ON complaints(station_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_tickets_station ON tickets(station_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_team ON tickets(team_id);
CREATE INDEX IF NOT EXISTS idx_tickets_dept ON tickets(department_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_team ON tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_dept ON tasks(department_id);
CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(task_date);
CREATE INDEX IF NOT EXISTS idx_ticket_logs_ticket ON ticket_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_ticket ON maintenance_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_task ON maintenance_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_water_stations_bag ON water_stations(bag_no);
CREATE INDEX IF NOT EXISTS idx_water_stations_code ON water_stations(code);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Departments
INSERT INTO departments (id, name) VALUES
  ('dept-admin',   'Захиргаа'),
  ('dept-water',   'Усан хангамжийн алба'),
  ('dept-housing', 'Орон сууцны алба'),
  ('dept-finance', 'Санхүү, эдийн засгийн хэлтэс')
ON CONFLICT (id) DO NOTHING;

-- Teams (leader_user_id set after users)
INSERT INTO teams (id, name, department_id, leader_user_id) VALUES
  ('team-1', '1-р засварын бригад', 'dept-water',   'user-bat'),
  ('team-2', '2-р засварын бригад', 'dept-water',   'user-dorj'),
  ('team-3', '3-р засварын бригад', 'dept-housing', 'user-oyun')
ON CONFLICT (id) DO NOTHING;

-- Users (passwords are bcrypt hashes)
-- admin/admin123, dispatcher/dispatch123, chief/chief123, eng1/eng123, bat/bat123, dorj/dorj123, oyun/oyun123
INSERT INTO users (id, full_name, username, password_hash, role, department_id, team_id, phone) VALUES
  ('user-admin',      'Систем админ',                    'admin',      '$2b$10$jKCsUuLX3mibVm3.oTMs0Oltb1KQnsMb9VQw3.12MAc/P2ASvbU6W', 'admin',               NULL,           NULL,     '99001122'),
  ('user-dispatcher', 'Диспетчер Мөнхцэцэг',             'dispatcher', '$2b$10$MgF/FolXiuMzIcmjNAu1eeG8Zp0KAKTWTYFAg6EqGFS0flq0EvcCO', 'dispatcher',          'dept-water',   NULL,     '99112233'),
  ('user-chief',      'Ерөнхий инженер Энхтөр',          'chief',      '$2b$10$.XIZEdtUMPKqB0SI1YR04.MFAMH/.19SFh1e2kGSbr1/5.URoxlx2', 'general_engineer',    'dept-water',   NULL,     '99223344'),
  ('user-eng1',       'Хэлтсийн инженер Оюунчимэг',      'eng1',       '$2b$10$safsPI.1JvNmKTpiP5/Q3.I6SsXJaT4yNrdBdd4se193vif9PmJ8.', 'department_engineer', 'dept-water',   NULL,     '99334455'),
  ('user-bat',        'Бат',                              'bat',        '$2b$10$nkZ37JrbZ8hJCGOdxDcJK.zw.ZpqxLJZrdgQM/VrI5.hXJUG67LIG', 'brigade_leader',      'dept-water',   'team-1', '99445566'),
  ('user-dorj',       'Дорж',                            'dorj',       '$2b$10$zRtIdFtKY3fSRAmm2B2SqukW4fI.Wk0DAxo53DhrlWEBwUObzeD7u', 'brigade_leader',      'dept-water',   'team-2', '99556677'),
  ('user-oyun',       'Оюун',                            'oyun',       '$2b$10$ZGrRSbII3AsQdJHz2UwdvOd/yoNANlw7hdNtQE4oWgeEz3jiKqoYe', 'brigade_leader',      'dept-housing', 'team-3', '99667788')
ON CONFLICT (id) DO NOTHING;

-- Water stations (15 bags x 22 stations = 330 stations)
-- Generated procedurally
DO $$
DECLARE
  bag_no INTEGER;
  station_no INTEGER;
  station_id VARCHAR(100);
  station_code VARCHAR(50);
  caretaker_names TEXT[] := ARRAY['Гэрэлмаа','Сарантуяа','Хонгорзул','Эрдэнэчимэг','Наранцэцэг','Ганцэцэг','Туул','Отгончимэг','Бадам','Мөнхтуяа','Оюунаа','Уранчимэг'];
  location_anchors TEXT[] := ARRAY['төв гудамж','сургууль орчим','цэцэрлэгийн ард','эмийн сангийн урд','захын урд тал','захын хойд тал','автобусны буудал','спорт заалны ард','уулзварын баруун тал','уулзварын зүүн тал','эмнэлгийн хажууд','хорооллын төв хэсэг','4-р хэсэг','6-р хэсэг','8-р хэсэг','10-р хэсэг','1-р эгнээ','2-р эгнээ','3-р эгнээ','5-р эгнээ','зүүн тойрог','баруун тойрог'];
  caretaker_name TEXT;
  location_str TEXT;
  caretaker_phone TEXT;
BEGIN
  FOR bag_no IN 1..15 LOOP
    FOR station_no IN 1..22 LOOP
      station_id := 'station-' || bag_no || '-' || station_no;
      station_code := bag_no || '-' || station_no;
      caretaker_name := caretaker_names[((bag_no + station_no - 2) % array_length(caretaker_names, 1)) + 1];
      location_str := 'Дархан сум, ' || bag_no || '-р баг, ' || location_anchors[((station_no - 1) % array_length(location_anchors, 1)) + 1];
      caretaker_phone := '88' || lpad(bag_no::text, 2, '0') || lpad(station_no::text, 4, '0');
      INSERT INTO water_stations (id, code, name, bag_no, location, caretaker_name, caretaker_phone)
      VALUES (station_id, station_code, '', bag_no, location_str, caretaker_name, caretaker_phone)
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Sample complaints
INSERT INTO complaints (id, station_id, issue_type, description, citizen_name, phone_number, source, status, created_at, created_by_label) VALUES
  ('complaint-1', 'station-1-14',  'Насос ажиллахгүй',     'Өглөө 08:00 цагаас хойш насос асахгүй байна.',                 'Мөнхзул', '88112233', 'web',   'new',       '2026-04-01T08:20:00.000Z', 'Иргэн'),
  ('complaint-2', 'station-14-2',  'Ус гоожиж байна',      'Үүдний хэсгээр ус гоожиж, шал норж байна.',                   'Цэцэг',   '88223344', 'phone', 'new',       '2026-04-01T09:05:00.000Z', 'Диспетчер'),
  ('complaint-3', 'station-15-8',  'Дэлгэц ажиллахгүй',   'Дэлгэц унтарсан, төлбөрийн мэдээлэл харагдахгүй байна.',       'Эрдэнэ',  '88334455', 'web',   'converted', '2026-03-31T11:40:00.000Z', 'Иргэн')
ON CONFLICT (id) DO NOTHING;

-- Sample tickets
INSERT INTO tickets (id, complaint_id, ticket_no, station_id, department_id, team_id, issue_type, description, priority, status, source, created_by, assigned_by, assigned_at, created_at) VALUES
  ('ticket-1', 'complaint-3', 'TKT-20260401-001', 'station-15-8', 'dept-water',   'team-1', 'Дэлгэц ажиллахгүй',   'Дэлгэцийн тэжээл тасарсан байж болзошгүй.',     'normal', 'assigned',   'web',   'user-dispatcher', 'user-dispatcher', '2026-04-01T07:55:00.000Z', '2026-04-01T07:45:00.000Z'),
  ('ticket-2', NULL,          'TKT-20260331-002', 'station-14-1', 'dept-water',   'team-2', 'Цахилгааны асуудал',  'Автомат таслуур байнга унаж байна.',             'urgent', 'in_progress','phone', 'user-dispatcher', 'user-dispatcher', '2026-03-31T10:10:00.000Z', '2026-03-31T09:50:00.000Z'),
  ('ticket-3', NULL,          'TKT-20260330-003', 'station-3-2',  'dept-housing', 'team-3', 'Хаалга/цоож эвдэрсэн','Гадна хаалганы цоож гацсан.',                    'normal', 'done',       'phone', 'user-dispatcher', 'user-dispatcher', '2026-03-30T06:35:00.000Z', '2026-03-30T06:20:00.000Z'),
  ('ticket-4', NULL,          'TKT-20260401-004', 'station-2-1',  NULL,           NULL,     'Насос ажиллахгүй',    'Ус татах үед насос огт асахгүй байна.',          'normal', 'new',        'phone', 'user-dispatcher', NULL,              NULL,                       '2026-04-01T08:35:00.000Z')
ON CONFLICT (id) DO NOTHING;

UPDATE tickets SET started_at = '2026-03-31T10:45:00.000Z' WHERE id = 'ticket-2';
UPDATE tickets SET started_at = '2026-03-30T08:10:00.000Z', finished_at = '2026-03-30T10:25:00.000Z' WHERE id = 'ticket-3';

-- Sample ticket logs
INSERT INTO ticket_logs (id, ticket_id, user_id, action, note, logged_at) VALUES
  ('ticket-log-1', 'ticket-1', 'user-dispatcher', 'Засварын хүсэлт үүсгэсэн', 'Иргэний веб хүсэлтийг засварын хүсэлт болгож бүртгэлээ.', '2026-04-01T07:45:00.000Z'),
  ('ticket-log-2', 'ticket-1', 'user-dispatcher', 'Багт хуваарилсан',          '1-р засварын бригад руу хуваарилсан.',                    '2026-04-01T07:55:00.000Z'),
  ('ticket-log-3', 'ticket-2', 'user-dispatcher', 'Яаралтай болгосон',         'Цахилгааны гэмтэл тул яаралтай ангилалд шилжүүлсэн.',    '2026-03-31T10:12:00.000Z'),
  ('ticket-log-4', 'ticket-2', 'user-dorj',       'Ажил эхэлсэн',              'Баг газар дээр очиж оношилж эхэлсэн.',                   '2026-03-31T10:45:00.000Z'),
  ('ticket-log-5', 'ticket-3', 'user-oyun',        'Ажил дууссан',             'Цоож сольж, хаалганы тэнхлэгийг тохируулсан.',           '2026-03-30T10:25:00.000Z')
ON CONFLICT (id) DO NOTHING;

-- Sample ticket workers
INSERT INTO ticket_workers (id, ticket_id, user_id) VALUES
  ('ticket-worker-1', 'ticket-2', 'user-dorj'),
  ('ticket-worker-2', 'ticket-3', 'user-oyun')
ON CONFLICT (id) DO NOTHING;

-- Sample tasks
INSERT INTO tasks (id, station_id, team_id, department_id, created_by, description, status, task_date, started_at, finished_at, work_report, created_at) VALUES
  ('task-1', 'station-15-3', 'team-1', 'dept-water',   'user-chief', 'Өдөр тутмын даралт шалгалт, насосны шүүлтүүр цэвэрлэгээ.',                'assigned',    '2026-04-01', NULL,                       NULL,                       NULL,                                   '2026-04-01T06:30:00.000Z'),
  ('task-2', 'station-3-2',  'team-3', 'dept-housing', 'user-chief', 'Өмнөх хаалганы засварын дараах хяналтын үзлэг.',                           'done',        '2026-04-01', '2026-04-01T08:00:00.000Z', '2026-04-01T09:10:00.000Z', 'Хаалга хэвийн ажиллаж байна. Нэмэлт асуудалгүй.', '2026-04-01T06:45:00.000Z'),
  ('task-3', 'station-14-2', 'team-2', 'dept-water',   'user-eng1',  'Усны шугамын холбоос хэсгийг урьдчилан сэргийлэх үзлэгт хамруулах.',      'in_progress', '2026-04-01', '2026-04-01T09:15:00.000Z', NULL,                       NULL,                                   '2026-04-01T07:20:00.000Z'),
  ('task-4', 'station-6-11', 'team-1', 'dept-water',   'user-chief', 'Төлөвлөгөөт насосны үзлэг, хавхлагын шалгалт.',                            'assigned',    '2026-04-12', NULL,                       NULL,                       NULL,                                   '2026-04-10T10:20:00.000Z'),
  ('task-5', 'station-9-7',  'team-2', 'dept-water',   'user-eng1',  'Цахилгааны самбарын урьдчилан сэргийлэх шалгалт.',                         'assigned',    '2026-04-13', NULL,                       NULL,                       NULL,                                   '2026-04-10T11:10:00.000Z'),
  ('task-6', 'station-12-18','team-3', 'dept-housing', 'user-chief', 'Гадна хаалга, цоож, хамгаалалтын хэсгийн үзлэг.',                          'assigned',    '2026-04-14', NULL,                       NULL,                       NULL,                                   '2026-04-10T11:45:00.000Z')
ON CONFLICT (id) DO NOTHING;

-- Sample maintenance logs
INSERT INTO maintenance_logs (id, ticket_id, task_id, team_id, description, materials_used, started_at, finished_at, created_at) VALUES
  ('maintenance-1', 'ticket-3', NULL,   'team-3', 'Гадна хаалганы цоожийг шинээр сольсон.',              'Цоож, бэхэлгээний боолт',  '2026-03-30T08:10:00.000Z', '2026-03-30T10:25:00.000Z', '2026-03-30T10:25:00.000Z'),
  ('maintenance-2', NULL,       'task-2','team-3', 'Засварын дараах үзлэг хийж, хаалганы ажиллагааг шалгав.', 'Материал ашиглаагүй',   '2026-04-01T08:00:00.000Z', '2026-04-01T09:10:00.000Z', '2026-04-01T09:10:00.000Z')
ON CONFLICT (id) DO NOTHING;
