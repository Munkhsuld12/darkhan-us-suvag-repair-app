-- Darkhan Us Suvag — Seed Data
-- Run after schema.sql
-- Safe to run multiple times (idempotent)

BEGIN;

-- ── Departments ──────────────────────────────────────────────
INSERT INTO departments (id, name) VALUES
  ('dept-admin',   'Захиргаа'),
  ('dept-water',   'Усан хангамжийн алба'),
  ('dept-housing', 'Орон сууцны алба'),
  ('dept-finance', 'Санхүү, эдийн засгийн хэлтэс')
ON CONFLICT (id) DO NOTHING;

-- ── Teams (leader set after users) ───────────────────────────
INSERT INTO teams (id, name, department_id, leader_user_id) VALUES
  ('team-1', '1-р засварын бригад', 'dept-water',   NULL),
  ('team-2', '2-р засварын бригад', 'dept-water',   NULL),
  ('team-3', '3-р засварын бригад', 'dept-housing', NULL)
ON CONFLICT (id) DO NOTHING;

-- ── Users (bcrypt via pgcrypto) ───────────────────────────────
INSERT INTO users (id, full_name, username, password_hash, role, department_id, team_id, phone, profile_complete) VALUES
  ('user-admin',      'Систем Админ',                'admin',      crypt('admin123',    gen_salt('bf', 10)), 'admin',               'dept-admin',   NULL,     '99001122', true),
  ('user-dispatcher', 'Диспетчер Мөнхцэцэг',         'dispatcher', crypt('dispatch123', gen_salt('bf', 10)), 'dispatcher',          'dept-water',   NULL,     '99112233', true),
  ('user-chief',      'Ерөнхий инженер Энхтөр',      'chief',      crypt('chief123',    gen_salt('bf', 10)), 'general_engineer',    'dept-water',   NULL,     '99223344', true),
  ('user-eng1',       'Хэлтсийн инженер Оюунчимэг',  'eng1',       crypt('eng123',      gen_salt('bf', 10)), 'department_engineer', 'dept-water',   NULL,     '99334455', true),
  ('user-bat',        'Бат',                          'bat',        crypt('bat123',      gen_salt('bf', 10)), 'brigade_leader',      'dept-water',   'team-1', '99445566', true),
  ('user-dorj',       'Дорж',                        'dorj',       crypt('dorj123',     gen_salt('bf', 10)), 'brigade_leader',      'dept-water',   'team-2', '99556677', true),
  ('user-oyun',       'Оюун',                        'oyun',       crypt('oyun123',     gen_salt('bf', 10)), 'brigade_leader',      'dept-housing', 'team-3', '99667788', true)
ON CONFLICT (id) DO NOTHING;

-- ── Teams — leader update ─────────────────────────────────────
UPDATE teams SET leader_user_id = 'user-bat'  WHERE id = 'team-1' AND leader_user_id IS NULL;
UPDATE teams SET leader_user_id = 'user-dorj' WHERE id = 'team-2' AND leader_user_id IS NULL;
UPDATE teams SET leader_user_id = 'user-oyun' WHERE id = 'team-3' AND leader_user_id IS NULL;

-- ── Water stations (15 bags × 22 = 330) ──────────────────────
INSERT INTO water_stations (id, code, name, bag_no, location, caretaker_name, caretaker_phone)
SELECT
  'station-' || b || '-' || s,
  b || '-' || s,
  '',
  b,
  'Дархан сум, ' || b || '-р баг, ' ||
    (ARRAY[
      'төв гудамж','сургууль орчим','цэцэрлэгийн ард','эмийн сангийн урд',
      'захын урд тал','захын хойд тал','автобусны буудал','спорт заалны ард',
      'уулзварын баруун тал','уулзварын зүүн тал','эмнэлгийн хажууд',
      'хорооллын төв хэсэг','4-р хэсэг','6-р хэсэг','8-р хэсэг','10-р хэсэг',
      '1-р эгнээ','2-р эгнээ','3-р эгнээ','5-р эгнээ','зүүн тойрог','баруун тойрог'
    ])[((s - 1) % 22) + 1],
  (ARRAY[
    'Гэрэлмаа','Сарантуяа','Хонгорзул','Эрдэнэчимэг','Наранцэцэг','Ганцэцэг',
    'Туул','Отгончимэг','Бадам','Мөнхтуяа','Оюунаа','Уранчимэг'
  ])[((b + s - 2) % 12) + 1],
  '88' || lpad(b::text, 2, '0') || lpad(s::text, 4, '0')
FROM generate_series(1, 15) b
CROSS JOIN generate_series(1, 22) s
ON CONFLICT (id) DO NOTHING;

-- ── Complaints ────────────────────────────────────────────────
INSERT INTO complaints (id, station_id, issue_type, description, citizen_name, phone_number, source, status, created_at, created_by_label) VALUES
  ('complaint-1', 'station-1-14', 'Насос ажиллахгүй',    'Өглөө 08:00 цагаас хойш насос асахгүй байна.',                 'Мөнхзул', '88112233', 'web',   'new',       '2026-04-01T08:20:00Z', 'Иргэн'),
  ('complaint-2', 'station-14-2', 'Ус гоожиж байна',     'Үүдний хэсгээр ус гоожиж, шал норж байна.',                   'Цэцэг',   '88223344', 'phone', 'new',       '2026-04-01T09:05:00Z', 'Диспетчер'),
  ('complaint-3', 'station-15-8', 'Дэлгэц ажиллахгүй',  'Дэлгэц унтарсан, төлбөрийн мэдээлэл харагдахгүй байна.',       'Эрдэнэ',  '88334455', 'web',   'converted', '2026-03-31T11:40:00Z', 'Иргэн')
ON CONFLICT (id) DO NOTHING;

-- ── Tickets ───────────────────────────────────────────────────
INSERT INTO tickets (id, complaint_id, ticket_no, station_id, department_id, team_id, issue_type, description, priority, status, source, created_by, assigned_by, assigned_at, created_at, started_at, finished_at) VALUES
  ('ticket-1', 'complaint-3', 'TKT-20260401-001', 'station-15-8', 'dept-water',   'team-1', 'Дэлгэц ажиллахгүй',    'Дэлгэцийн тэжээл тасарсан байж болзошгүй.',   'normal', 'assigned',    'web',   'user-dispatcher', 'user-dispatcher', '2026-04-01T07:55:00Z', '2026-04-01T07:45:00Z', NULL,                   NULL),
  ('ticket-2', NULL,          'TKT-20260331-002', 'station-14-1', 'dept-water',   'team-2', 'Цахилгааны асуудал',   'Автомат таслуур байнга унаж байна.',           'urgent', 'in_progress', 'phone', 'user-dispatcher', 'user-dispatcher', '2026-03-31T10:10:00Z', '2026-03-31T09:50:00Z', '2026-03-31T10:45:00Z', NULL),
  ('ticket-3', NULL,          'TKT-20260330-003', 'station-3-2',  'dept-housing', 'team-3', 'Хаалга/цоож эвдэрсэн', 'Гадна хаалганы цоож гацсан.',                  'normal', 'done',        'phone', 'user-dispatcher', 'user-dispatcher', '2026-03-30T06:35:00Z', '2026-03-30T06:20:00Z', '2026-03-30T08:10:00Z', '2026-03-30T10:25:00Z'),
  ('ticket-4', NULL,          'TKT-20260401-004', 'station-2-1',  NULL,           NULL,     'Насос ажиллахгүй',     'Ус татах үед насос огт асахгүй байна.',        'normal', 'new',         'phone', 'user-dispatcher', NULL,              NULL,                   '2026-04-01T08:35:00Z', NULL,                   NULL)
ON CONFLICT (id) DO NOTHING;

-- ── Ticket logs ───────────────────────────────────────────────
INSERT INTO ticket_logs (id, ticket_id, user_id, action, note, logged_at) VALUES
  ('ticket-log-1', 'ticket-1', 'user-dispatcher', 'Засварын хүсэлт үүсгэсэн', 'Иргэний веб хүсэлтийг засварын хүсэлт болгож бүртгэлээ.', '2026-04-01T07:45:00Z'),
  ('ticket-log-2', 'ticket-1', 'user-dispatcher', 'Багт хуваарилсан',         '1-р засварын бригад руу хуваарилсан.',                    '2026-04-01T07:55:00Z'),
  ('ticket-log-3', 'ticket-2', 'user-dispatcher', 'Яаралтай болгосон',        'Цахилгааны гэмтэл тул яаралтай ангилалд шилжүүлсэн.',    '2026-03-31T10:12:00Z'),
  ('ticket-log-4', 'ticket-2', 'user-dorj',       'Ажил эхэлсэн',             'Баг газар дээр очиж оношилж эхэлсэн.',                   '2026-03-31T10:45:00Z'),
  ('ticket-log-5', 'ticket-3', 'user-oyun',       'Ажил дууссан',             'Цоож сольж, хаалганы тэнхлэгийг тохируулсан.',           '2026-03-30T10:25:00Z')
ON CONFLICT (id) DO NOTHING;

-- ── Ticket workers ────────────────────────────────────────────
INSERT INTO ticket_workers (id, ticket_id, user_id) VALUES
  ('ticket-worker-1', 'ticket-2', 'user-dorj'),
  ('ticket-worker-2', 'ticket-3', 'user-oyun')
ON CONFLICT (id) DO NOTHING;

-- ── Tasks ─────────────────────────────────────────────────────
INSERT INTO tasks (id, station_id, team_id, department_id, created_by, description, status, task_date, started_at, finished_at, work_report, created_at) VALUES
  ('task-1', 'station-15-3',  'team-1', 'dept-water',   'user-chief', 'Өдөр тутмын даралт шалгалт, насосны шүүлтүүр цэвэрлэгээ.',           'assigned',    '2026-04-01', NULL,                   NULL,                   NULL,                                      '2026-04-01T06:30:00Z'),
  ('task-2', 'station-3-2',   'team-3', 'dept-housing', 'user-chief', 'Өмнөх хаалганы засварын дараах хяналтын үзлэг.',                      'done',        '2026-04-01', '2026-04-01T08:00:00Z', '2026-04-01T09:10:00Z', 'Хаалга хэвийн ажиллаж байна. Нэмэлт асуудалгүй.', '2026-04-01T06:45:00Z'),
  ('task-3', 'station-14-2',  'team-2', 'dept-water',   'user-eng1',  'Усны шугамын холбоос хэсгийг урьдчилан сэргийлэх үзлэгт хамруулах.', 'in_progress', '2026-04-01', '2026-04-01T09:15:00Z', NULL,                   NULL,                                      '2026-04-01T07:20:00Z'),
  ('task-4', 'station-6-11',  'team-1', 'dept-water',   'user-chief', 'Төлөвлөгөөт насосны үзлэг, хавхлагын шалгалт.',                      'assigned',    '2026-04-12', NULL,                   NULL,                   NULL,                                      '2026-04-10T10:20:00Z'),
  ('task-5', 'station-9-7',   'team-2', 'dept-water',   'user-eng1',  'Цахилгааны самбарын урьдчилан сэргийлэх шалгалт.',                    'assigned',    '2026-04-13', NULL,                   NULL,                   NULL,                                      '2026-04-10T11:10:00Z'),
  ('task-6', 'station-12-18', 'team-3', 'dept-housing', 'user-chief', 'Гадна хаалга, цоож, хамгаалалтын хэсгийн үзлэг.',                    'assigned',    '2026-04-14', NULL,                   NULL,                   NULL,                                      '2026-04-10T11:45:00Z')
ON CONFLICT (id) DO NOTHING;

-- ── Maintenance logs ──────────────────────────────────────────
INSERT INTO maintenance_logs (id, ticket_id, task_id, team_id, description, materials_used, started_at, finished_at, created_at) VALUES
  ('maintenance-1', 'ticket-3', NULL,     'team-3', 'Гадна хаалганы цоожийг шинээр сольсон.',               'Цоож, бэхэлгээний боолт', '2026-03-30T08:10:00Z', '2026-03-30T10:25:00Z', '2026-03-30T10:25:00Z'),
  ('maintenance-2', NULL,       'task-2', 'team-3', 'Засварын дараах үзлэг хийж, хаалганы ажиллагааг шалгав.', 'Материал ашиглаагүй',   '2026-04-01T08:00:00Z', '2026-04-01T09:10:00Z', '2026-04-01T09:10:00Z')
ON CONFLICT (id) DO NOTHING;

COMMIT;
