-- ============================================================
-- Дархан-Ус Суваг — Дипломын үзлэгт зориулсан demo өгөгдөл
-- Огноо: 2026-06-03 (одоогийн он сар)
-- Ажиллуулах: psql -U postgres -d darkhan_us_suvag -f seed_demo.sql
-- ============================================================

-- Хуучин өгөгдлийг цэвэрлэх
DELETE FROM maintenance_logs;
DELETE FROM ticket_logs;
DELETE FROM ticket_workers;
DELETE FROM workers;
DELETE FROM tasks;
DELETE FROM tickets;
DELETE FROM complaints;

-- ============================================================
-- БРИГАДЫН АЖИЛТНУУД (workers table)
-- ============================================================
INSERT INTO workers (id, full_name, phone, position, team_id) VALUES
  ('w-bat-1', 'Болд Дорж',      '9911-2233', 'Сантехникч',    (SELECT id FROM teams WHERE name = '1-р засварын бригад')),
  ('w-bat-2', 'Ганбаатар Сүрэн','9944-5566', 'Тоног төхөөрөмжийн засварчин', (SELECT id FROM teams WHERE name = '1-р засварын бригад')),
  ('w-bat-3', 'Мөнхбат Батаа',  '9977-8899', 'Туслах',        (SELECT id FROM teams WHERE name = '1-р засварын бригад')),
  ('w-dorj-1','Нямдорж Галаа',  '9922-3344', 'Сантехникч',    (SELECT id FROM teams WHERE name = '2-р засварын бригад')),
  ('w-dorj-2','Дамдин Батболд', '9955-6677', 'Тоног төхөөрөмжийн засварчин', (SELECT id FROM teams WHERE name = '2-р засварын бригад')),
  ('w-oyun-1','Баярсайхан Мөнх','9933-4455', 'Сантехникч',    (SELECT id FROM teams WHERE name = '3-р засварын бригад')),
  ('w-oyun-2','Оюунчимэг Дорж', '9966-7788', 'Туслах',        (SELECT id FROM teams WHERE name = '3-р засварын бригад'));

-- ============================================================
-- ГОМДОЛУУД (complaints)
-- ============================================================
INSERT INTO complaints (id, station_id, issue_type, description, citizen_name, phone_number, source, status, created_at, created_by_label) VALUES
  -- Хөрвүүлсэн гомдлууд
  ('comp-001', (SELECT id FROM water_stations WHERE code='2-3'), 'Ус гарахгүй',
   'Өнөөдөр эртнээс ус гараагүй байна, хашааны цорго бүр хатаж байна',
   'Батсайхан Нямаа','9900-1122','web','converted','2026-05-28 08:15:00+08',''),

  ('comp-002', (SELECT id FROM water_stations WHERE code='1-5'), 'Хоолой хагарсан',
   'Газрын доорх хоолой хагарч ус гудамжинд урсаж байна',
   'Энхтуяа Гомбо','9900-2233','phone','converted','2026-05-29 10:30:00+08','dispatcher'),

  ('comp-003', (SELECT id FROM water_stations WHERE code='3-2'), 'Насос ажиллахгүй',
   'Худгийн насос гэнэт зогссон, 2 хоног болж байна',
   'Дорждэлгэр Санжаа','9900-3344','phone','converted','2026-05-30 09:00:00+08','dispatcher'),

  ('comp-004', (SELECT id FROM water_stations WHERE code='1-3'), 'Тоолуур эвдэрсэн',
   'Тоолуур буруу заалт гаргаж байна, сарын тооцоо их гарч байна',
   'Өлзийбаяр Цогт','9900-4455','web','converted','2026-06-01 11:20:00+08',''),

  ('comp-005', (SELECT id FROM water_stations WHERE code='4-1'), 'Усны даралт бага',
   'Даралт маш бага болж ус хэрэглэхэд хүрэлцэхгүй байна',
   'Мөнхзул Ариунаа','9900-5566','web','converted','2026-06-02 14:45:00+08',''),

  -- Шинэ гомдлууд (бүртгэгдэж байгаа)
  ('comp-006', (SELECT id FROM water_stations WHERE code='2-1'), 'Ус гарахгүй',
   'Өчигдрөөс ус гарахгүй болсон',
   'Анхтуяа Лхагва','9900-6677','web','new','2026-06-03 07:30:00+08',''),

  ('comp-007', (SELECT id FROM water_stations WHERE code='5-3'), 'Хоолой хагарсан',
   'Цорго ойролцоо газар нороод байна ус үргэлж урсаж байгаа юм шиг',
   'Батэрдэнэ Сод','9900-7788','phone','new','2026-06-03 09:15:00+08','dispatcher'),

  ('comp-008', (SELECT id FROM water_stations WHERE code='1-2'), 'Цахилгааны гэмтэл',
   'Цахилгааны самбар шатсан болов уу дуугарч байгаад унтарчихлаа',
   'Нандинцэцэг Алт','9900-8899','web','new','2026-06-03 10:00:00+08','');

-- ============================================================
-- ЗАСВАРЫН ХҮСЭЛТ (tickets) — Дууссан
-- ============================================================
INSERT INTO tickets (id, complaint_id, ticket_no, station_id, department_id, team_id,
  issue_type, description, priority, status, source,
  created_by, assigned_by, assigned_at, created_at, started_at, finished_at) VALUES

  -- 1. Дууссан — 1-р бригад (bat)
  ('tkt-001','comp-001','ТКТ-20260528-001',
   (SELECT id FROM water_stations WHERE code='2-3'),
   (SELECT id FROM departments WHERE name='Усан хангамжийн алба'),
   (SELECT id FROM teams WHERE name='1-р засварын бригад'),
   'Ус гарахгүй','Ус түгээх хоолойн холболт сулласан. Нийт 3 айлд нөлөөлж байна.',
   'normal','done','web',
   (SELECT id FROM users WHERE username='dispatcher'),
   (SELECT id FROM users WHERE username='dispatcher'),
   '2026-05-28 09:00:00+08','2026-05-28 08:15:00+08',
   '2026-05-28 09:30:00+08','2026-05-28 11:45:00+08'),

  -- 2. Дууссан — 1-р бригад (bat)
  ('tkt-002','comp-002','ТКТ-20260529-001',
   (SELECT id FROM water_stations WHERE code='1-5'),
   (SELECT id FROM departments WHERE name='Усан хангамжийн алба'),
   (SELECT id FROM teams WHERE name='1-р засварын бригад'),
   'Хоолой хагарсан','Газрын доорх DN50 хоолой 80см урт хэсэгт хагарсан. Яаралтай солих шаардлагатай.',
   'urgent','done','phone',
   (SELECT id FROM users WHERE username='dispatcher'),
   (SELECT id FROM users WHERE username='dispatcher'),
   '2026-05-29 10:45:00+08','2026-05-29 10:30:00+08',
   '2026-05-29 11:00:00+08','2026-05-29 14:30:00+08'),

  -- 3. Дууссан — 2-р бригад (dorj)
  ('tkt-003','comp-003','ТКТ-20260530-001',
   (SELECT id FROM water_stations WHERE code='3-2'),
   (SELECT id FROM departments WHERE name='Усан хангамжийн алба'),
   (SELECT id FROM teams WHERE name='2-р засварын бригад'),
   'Насос ажиллахгүй','Насосны электродвигатель шатсан. Шинэ хөдөлгүүр суурилуулах шаардлагатай.',
   'urgent','done','phone',
   (SELECT id FROM users WHERE username='dispatcher'),
   (SELECT id FROM users WHERE username='chief'),
   '2026-05-30 09:15:00+08','2026-05-30 09:00:00+08',
   '2026-05-30 09:30:00+08','2026-05-30 13:00:00+08'),

  -- 4. Дууссан — 1-р бригад (bat)
  ('tkt-004','comp-004','ТКТ-20260601-001',
   (SELECT id FROM water_stations WHERE code='1-3'),
   (SELECT id FROM departments WHERE name='Тоолуур, бүртгэлийн алба'),
   (SELECT id FROM teams WHERE name='1-р засварын бригад'),
   'Тоолуур эвдэрсэн','Механик тоолуур DN15 нийт эвдэрсэн. Цахилгаан тоолуураар солих.',
   'normal','done','web',
   (SELECT id FROM users WHERE username='dispatcher'),
   (SELECT id FROM users WHERE username='eng1'),
   '2026-06-01 11:30:00+08','2026-06-01 11:20:00+08',
   '2026-06-01 13:00:00+08','2026-06-01 15:30:00+08'),

  -- 5. Дууссан — 3-р бригад (oyun)
  ('tkt-005','comp-005','ТКТ-20260602-001',
   (SELECT id FROM water_stations WHERE code='4-1'),
   (SELECT id FROM departments WHERE name='Усан хангамжийн алба'),
   (SELECT id FROM teams WHERE name='3-р засварын бригад'),
   'Усны даралт бага','Даралт хэмжүүр 0.8 bar-аас буусан. Хавхлагын тохиргоо хийх.',
   'normal','done','web',
   (SELECT id FROM users WHERE username='dispatcher'),
   (SELECT id FROM users WHERE username='dispatcher'),
   '2026-06-02 15:00:00+08','2026-06-02 14:45:00+08',
   '2026-06-02 15:30:00+08','2026-06-02 17:00:00+08');

-- ============================================================
-- ЗАСВАРЫН ХҮСЭЛТ — Явцдаа / Хуваарилсан / Шинэ
-- ============================================================
INSERT INTO tickets (id, complaint_id, ticket_no, station_id, department_id, team_id,
  issue_type, description, priority, status, source,
  created_by, assigned_by, assigned_at, created_at, started_at, finished_at) VALUES

  -- 6. Явцдаа — 1-р бригад (bat) — өнөөдөр эхэлсэн
  ('tkt-006',NULL,'ТКТ-20260603-001',
   (SELECT id FROM water_stations WHERE code='2-1'),
   (SELECT id FROM departments WHERE name='Усан хангамжийн алба'),
   (SELECT id FROM teams WHERE name='1-р засварын бригад'),
   'Ус гарахгүй','Шугамын даралт алдагдсан. Байцаалт хийж тогтоох шаардлагатай.',
   'normal','in_progress','web',
   (SELECT id FROM users WHERE username='dispatcher'),
   (SELECT id FROM users WHERE username='dispatcher'),
   '2026-06-03 08:30:00+08','2026-06-03 07:30:00+08',
   '2026-06-03 09:00:00+08',NULL),

  -- 7. Явцдаа — 2-р бригад (dorj) — яаралтай
  ('tkt-007','comp-007','ТКТ-20260603-002',
   (SELECT id FROM water_stations WHERE code='5-3'),
   (SELECT id FROM departments WHERE name='Усан хангамжийн алба'),
   (SELECT id FROM teams WHERE name='2-р засварын бригад'),
   'Хоолой хагарсан','Газрын гадаргуу дээр ус гарч байгаа нь доорх хоолой хагарсан болов уу.',
   'urgent','in_progress','phone',
   (SELECT id FROM users WHERE username='dispatcher'),
   (SELECT id FROM users WHERE username='dispatcher'),
   '2026-06-03 09:30:00+08','2026-06-03 09:15:00+08',
   '2026-06-03 10:00:00+08',NULL),

  -- 8. Хуваарилсан — 1-р бригад (bat)
  ('tkt-008','comp-006','ТКТ-20260603-003',
   (SELECT id FROM water_stations WHERE code='1-2'),
   (SELECT id FROM departments WHERE name='Тоолуур, бүртгэлийн алба'),
   (SELECT id FROM teams WHERE name='1-р засварын бригад'),
   'Цахилгааны гэмтэл','Цахилгааны самбарт асуудал гарсан байж болзошгүй. Шалгах шаардлагатай.',
   'urgent','assigned','web',
   (SELECT id FROM users WHERE username='dispatcher'),
   (SELECT id FROM users WHERE username='dispatcher'),
   '2026-06-03 10:15:00+08','2026-06-03 10:00:00+08',
   NULL,NULL),

  -- 9. Хуваарилсан — 3-р бригад (oyun)
  ('tkt-009',NULL,'ТКТ-20260603-004',
   (SELECT id FROM water_stations WHERE code='3-5'),
   (SELECT id FROM departments WHERE name='Усан хангамжийн алба'),
   (SELECT id FROM teams WHERE name='3-р засварын бригад'),
   'Усны даралт бага','Орон сууцны блок дахь даралт буурсан тухай гомдол ирсэн.',
   'normal','assigned','phone',
   (SELECT id FROM users WHERE username='dispatcher'),
   (SELECT id FROM users WHERE username='dispatcher'),
   '2026-06-03 10:45:00+08','2026-06-03 10:30:00+08',
   NULL,NULL),

  -- 10. Шинэ — хуваарилагдаагүй
  ('tkt-010','comp-008','ТКТ-20260603-005',
   (SELECT id FROM water_stations WHERE code='1-2'),
   NULL,NULL,
   'Цахилгааны гэмтэл','Цахилгааны самбар шатсан.',
   'urgent','new','web',
   (SELECT id FROM users WHERE username='dispatcher'),
   NULL,NULL,'2026-06-03 10:00:00+08',NULL,NULL);

-- ============================================================
-- ӨДӨР ТУТМЫН АЖИЛ (tasks)
-- ============================================================
INSERT INTO tasks (id, station_id, team_id, department_id, created_by,
  description, status, task_date, started_at, finished_at, work_report, created_at) VALUES

  -- 1. Дууссан
  ('task-001',
   (SELECT id FROM water_stations WHERE code='1-4'),
   (SELECT id FROM teams WHERE name='1-р засварын бригад'),
   (SELECT id FROM departments WHERE name='Усан хангамжийн алба'),
   (SELECT id FROM users WHERE username='chief'),
   'Хаалтын хавхлагуудын улирлын үзлэг — 1-р дэд байр',
   'done','2026-05-30',
   '2026-05-30 08:00:00+08','2026-05-30 11:30:00+08',
   'Нийт 8 хавхлагыг шалгаж, хоёрыг нь тохируулсан. Мэдрэгчийг шинэчилсэн.
Оролцсон ажилтнууд: Болд Дорж, Мөнхбат Батаа',
   '2026-05-29 16:00:00+08'),

  -- 2. Дууссан
  ('task-002',
   (SELECT id FROM water_stations WHERE code='2-2'),
   (SELECT id FROM teams WHERE name='2-р засварын бригад'),
   (SELECT id FROM departments WHERE name='Усан хангамжийн алба'),
   (SELECT id FROM users WHERE username='eng1'),
   'Шүүлтүүрийн цэвэрлэгээ ба байцаалт',
   'done','2026-06-02',
   '2026-06-02 09:00:00+08','2026-06-02 12:00:00+08',
   'Шүүлтүүрийг цэвэрлэж угаасан. Бүрэн ажиллагаатай болсон.
Оролцсон ажилтнууд: Нямдорж Галаа, Дамдин Батболд',
   '2026-06-01 15:00:00+08'),

  -- 3. Явцдаа
  ('task-003',
   (SELECT id FROM water_stations WHERE code='3-1'),
   (SELECT id FROM teams WHERE name='3-р засварын бригад'),
   (SELECT id FROM departments WHERE name='Усан хангамжийн алба'),
   (SELECT id FROM users WHERE username='chief'),
   'Насосны техник үзлэг ба мэдрэгч тохиргоо',
   'in_progress','2026-06-03',
   '2026-06-03 09:00:00+08',NULL,NULL,
   '2026-06-02 17:00:00+08'),

  -- 4. Хуваарилсан (маргааш)
  ('task-004',
   (SELECT id FROM water_stations WHERE code='1-1'),
   (SELECT id FROM teams WHERE name='1-р засварын бригад'),
   (SELECT id FROM departments WHERE name='Тоолуур, бүртгэлийн алба'),
   (SELECT id FROM users WHERE username='eng1'),
   'Тоолуурын улирлын уншилт ба баталгаажуулалт — 1-р дэд байр бүх худаг',
   'assigned','2026-06-04',
   NULL,NULL,NULL,
   '2026-06-03 09:00:00+08'),

  -- 5. Хуваарилсан (маргааш)
  ('task-005',
   (SELECT id FROM water_stations WHERE code='4-2'),
   (SELECT id FROM teams WHERE name='2-р засварын бригад'),
   (SELECT id FROM departments WHERE name='Усан хангамжийн алба'),
   (SELECT id FROM users WHERE username='chief'),
   'Хоолойн угсралтын шалгалт ба хамгаалалтын будгийн шинэчлэл',
   'assigned','2026-06-04',
   NULL,NULL,NULL,
   '2026-06-03 10:00:00+08');

-- ============================================================
-- ЗАСВАРЫН БҮРТГЭЛ (maintenance_logs) — Дууссан ажлуудад
-- ============================================================
INSERT INTO maintenance_logs (id, ticket_id, task_id, team_id,
  description, materials_used, started_at, finished_at, created_at) VALUES

  -- tkt-001: Ус гарахгүй
  ('ml-001','tkt-001',NULL,
   (SELECT id FROM teams WHERE name='1-р засварын бригад'),
   'Холболтын хэсгийг задлан шалгаж зурвас нь урагдсан байсан. Шинэ зурвас орж буцааж холбосон.
Оролцсон ажилтнууд: Болд Дорж, Ганбаатар Сүрэн',
   'Зурвас, Клип / Боолт',
   '2026-05-28 09:30:00+08','2026-05-28 11:45:00+08','2026-05-28 11:45:00+08'),

  -- tkt-002: Хоолой хагарсан
  ('ml-002','tkt-002',NULL,
   (SELECT id FROM teams WHERE name='1-р засварын бригад'),
   'DN50 хоолойн хагарсан хэсгийг малтаж 80см шинэ хоолойгоор сольсон. Газрыг буцааж нөхсөн.
Оролцсон ажилтнууд: Болд Дорж, Ганбаатар Сүрэн, Мэнхбат Батаа',
   'Хоолой, Клип / Боолт, Зурвас',
   '2026-05-29 11:00:00+08','2026-05-29 14:30:00+08','2026-05-29 14:30:00+08'),

  -- tkt-003: Насос ажиллахгүй
  ('ml-003','tkt-003',NULL,
   (SELECT id FROM teams WHERE name='2-р засварын бригад'),
   'Шатсан электродвигателийг солиод насосыг туршилтаар ажиллуулав. Бүрэн ажиллагаатай болсон.
Оролцсон ажилтнууд: Нямдорж Галаа, Дамдин Батболд',
   'Насос, Залгуур',
   '2026-05-30 09:30:00+08','2026-05-30 13:00:00+08','2026-05-30 13:00:00+08'),

  -- tkt-004: Тоолуур эвдэрсэн
  ('ml-004','tkt-004',NULL,
   (SELECT id FROM teams WHERE name='1-р засварын бригад'),
   'DN15 механик тоолуурыг задлан авч цахилгаан тоолуур суурилуулсан. Хэрэглэгчид танилцуулсан.
Оролцсон ажилтнууд: Болд Дорж, Мэнхбат Батаа',
   'Тоолуур',
   '2026-06-01 13:00:00+08','2026-06-01 15:30:00+08','2026-06-01 15:30:00+08'),

  -- tkt-005: Усны даралт бага
  ('ml-005','tkt-005',NULL,
   (SELECT id FROM teams WHERE name='3-р засварын бригад'),
   'Хавхлагын тохиргоог 1.5 bar болгон тохируулав. Даралт хэвийн болсон.
Оролцсон ажилтнууд: Баярсайхан Мөнх, Оюунчимэг Дорж',
   'Хавхлага, Мэдрэгч',
   '2026-06-02 15:30:00+08','2026-06-02 17:00:00+08','2026-06-02 17:00:00+08'),

  -- task-001: Улирлын үзлэг
  ('ml-006',NULL,'task-001',
   (SELECT id FROM teams WHERE name='1-р засварын бригад'),
   'Нийт 8 хавхлагыг шалгаж 2-г нь тохируулав. Мэдрэгч шинэчилсэн.
Оролцсон ажилтнууд: Болд Дорж, Мэнхбат Батаа',
   'Мэдрэгч, Клип / Боолт',
   '2026-05-30 08:00:00+08','2026-05-30 11:30:00+08','2026-05-30 11:30:00+08'),

  -- task-002: Шүүлтүүрийн цэвэрлэгээ
  ('ml-007',NULL,'task-002',
   (SELECT id FROM teams WHERE name='2-р засварын бригад'),
   'Шүүлтүүрийг цэвэрлэж угаасан. Бүрэн ажиллагаатай болсон.
Оролцсон ажилтнууд: Нямдорж Галаа, Дамдин Батболд',
   'Шүүлтүүр',
   '2026-06-02 09:00:00+08','2026-06-02 12:00:00+08','2026-06-02 12:00:00+08');

-- ============================================================
-- ТАСАЛБАРЫН ЛОГ (ticket_logs)
-- ============================================================
INSERT INTO ticket_logs (id, ticket_id, user_id, action, note, logged_at) VALUES
  ('tl-001','tkt-001',(SELECT id FROM users WHERE username='dispatcher'),'created','Гомдлоос бүртгэсэн','2026-05-28 08:15:00+08'),
  ('tl-002','tkt-001',(SELECT id FROM users WHERE username='dispatcher'),'assigned','1-р бригадад хуваарилсан','2026-05-28 09:00:00+08'),
  ('tl-003','tkt-001',(SELECT id FROM users WHERE username='bat'),'started','Ажил эхэллээ','2026-05-28 09:30:00+08'),
  ('tl-004','tkt-001',(SELECT id FROM users WHERE username='bat'),'finished','Амжилттай дуусгав','2026-05-28 11:45:00+08'),

  ('tl-005','tkt-002',(SELECT id FROM users WHERE username='dispatcher'),'created','Гомдлоос бүртгэсэн','2026-05-29 10:30:00+08'),
  ('tl-006','tkt-002',(SELECT id FROM users WHERE username='dispatcher'),'assigned','1-р бригадад яаралтай хуваарилсан','2026-05-29 10:45:00+08'),
  ('tl-007','tkt-002',(SELECT id FROM users WHERE username='bat'),'started','Ажил эхэллээ','2026-05-29 11:00:00+08'),
  ('tl-008','tkt-002',(SELECT id FROM users WHERE username='bat'),'finished','Хоолой солигдлоо','2026-05-29 14:30:00+08'),

  ('tl-009','tkt-006',(SELECT id FROM users WHERE username='dispatcher'),'created','Шинэ дуудлага','2026-06-03 07:30:00+08'),
  ('tl-010','tkt-006',(SELECT id FROM users WHERE username='dispatcher'),'assigned','1-р бригадад хуваарилсан','2026-06-03 08:30:00+08'),
  ('tl-011','tkt-006',(SELECT id FROM users WHERE username='bat'),'started','Ажил эхэллээ','2026-06-03 09:00:00+08'),

  ('tl-012','tkt-007',(SELECT id FROM users WHERE username='dispatcher'),'created','Утасны дуудлагаас','2026-06-03 09:15:00+08'),
  ('tl-013','tkt-007',(SELECT id FROM users WHERE username='dispatcher'),'assigned','2-р бригадад яаралтай','2026-06-03 09:30:00+08'),
  ('tl-014','tkt-007',(SELECT id FROM users WHERE username='dorj'),'started','Ажил эхэллээ','2026-06-03 10:00:00+08');
