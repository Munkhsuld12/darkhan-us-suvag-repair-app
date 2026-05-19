// Usage: node seed-today.js
// Adds today's sample tasks and tickets per brigade to test progress bars
require("dotenv").config({ path: __dirname + "/.env" });
const { Client } = require("pg");
const { randomUUID } = require("crypto");

const TODAY = new Date().toISOString().slice(0, 10);
const NOW   = new Date().toISOString();

// Per-team work: mix of done / in_progress / assigned
const WORK = [
  [
    { type:"task",   status:"done",        desc:"Насосны шалгалт хийх",          issue:"Тогтмол үзлэг" },
    { type:"task",   status:"done",        desc:"Хоолойн холболт шалгах",         issue:"Тогтмол үзлэг" },
    { type:"ticket", status:"in_progress", issue:"Ус гарахгүй",  desc:"Насос ажиллахгүй байна" },
  ],
  [
    { type:"task",   status:"done",        desc:"Шүүлтүүр цэвэрлэх",             issue:"Тогтмол үзлэг" },
    { type:"ticket", status:"assigned",    issue:"Усны даралт бага", desc:"Даралт хэвийн бус" },
    { type:"ticket", status:"assigned",    issue:"Хоолой хагарсан",  desc:"Газрын хоолой алдагдалтай" },
  ],
  [
    { type:"task",   status:"in_progress", desc:"Тоолуур уншилт авах",            issue:"Тогтмол үзлэг" },
    { type:"task",   status:"assigned",    desc:"Хавхлага шалгах",               issue:"Тогтмол үзлэг" },
  ],
  [
    { type:"ticket", status:"done",        issue:"Тоолуур эвдэрсэн", desc:"Тоолуур солигдлоо" },
    { type:"ticket", status:"done",        issue:"Цахилгааны гэмтэл",desc:"Залгуур солигдлоо" },
    { type:"ticket", status:"done",        issue:"Ус бохирдсон",      desc:"Шүүлтүүр ариутгагдлаа" },
    { type:"task",   status:"done",        desc:"Өдрийн тайлан гаргах",           issue:"Тогтмол үзлэг" },
  ],
];

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const stations = (await client.query(
      "SELECT id FROM water_stations WHERE deleted_at IS NULL ORDER BY bag_no, code"
    )).rows;
    const teams = (await client.query(
      "SELECT id, department_id FROM teams WHERE deleted_at IS NULL ORDER BY name"
    )).rows;
    const dispatcher = (await client.query(
      "SELECT id FROM users WHERE role='dispatcher' AND deleted_at IS NULL LIMIT 1"
    )).rows[0];

    if (!stations.length) { console.error("Станц олдсонгүй"); process.exit(1); }
    if (!teams.length)    { console.error("Бригад олдсонгүй"); process.exit(1); }

    const dispId = dispatcher?.id ?? null;
    let taskCount = 0, ticketCount = 0;

    for (let ti = 0; ti < teams.length; ti++) {
      const team    = teams[ti];
      const items   = WORK[ti % WORK.length];

      for (let wi = 0; wi < items.length; wi++) {
        const w       = items[wi];
        const station = stations[(ti * 3 + wi) % stations.length];

        if (w.type === "task") {
          await client.query(
            `INSERT INTO tasks
               (id, station_id, team_id, department_id, description,
                task_date, status, created_by, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT DO NOTHING`,
            [
              randomUUID(), station.id, team.id, team.department_id,
              w.desc, TODAY, w.status, dispId, NOW,
            ]
          );
          taskCount++;
        } else {
          const no = `TKT-TODAY-${String(ti * 10 + wi + 1).padStart(3, "0")}`;
          const isDone = w.status === "done";
          await client.query(
            `INSERT INTO tickets
               (id, ticket_no, station_id, department_id, team_id,
                issue_type, description, priority, status, source,
                created_by, assigned_by, assigned_at, created_at
                ${isDone ? ", started_at, finished_at" : ""})
             VALUES ($1,$2,$3,$4,$5,$6,$7,'normal',$8,'phone',$9,$9,$10,$11
                ${isDone ? ",$12,$13" : ""})
             ON CONFLICT DO NOTHING`,
            isDone
              ? [randomUUID(), no, station.id, team.department_id, team.id,
                 w.issue, w.desc, w.status, dispId, NOW, NOW, NOW, NOW]
              : [randomUUID(), no, station.id, team.department_id, team.id,
                 w.issue, w.desc, w.status, dispId, NOW, NOW]
          );
          ticketCount++;
        }
      }
      console.log(`✓ ${team.id} — ${items.length} ажил нэмэгдлээ`);
    }

    console.log(`\nНийт: ${taskCount} ажлын даалгавар, ${ticketCount} засварын хүсэлт (өнөөдрийн огноотой)`);
  } finally {
    await client.end();
  }
})();
