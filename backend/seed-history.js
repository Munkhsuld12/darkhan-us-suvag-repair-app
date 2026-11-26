// Usage: node seed-history.js
// Adds sample completed maintenance history to existing wells
require("dotenv").config({ path: __dirname + "/.env" });
const { Client } = require("pg");
const { randomUUID } = require("crypto");

const HISTORY = [
  { issueType: "Ус гарахгүй",        desc: "Насосны мэдрэгч гэмтсэн, солигдлоо",          materials: "Мэдрэгч x1",         daysAgo: 3,  durationH: 4 },
  { issueType: "Усны даралт бага",    desc: "Шугамын хавхлага суллагдсан, чангалагдлаа",   materials: "Хавхлага x2",        daysAgo: 7,  durationH: 3 },
  { issueType: "Хоолой хагарсан",     desc: "Газар доорх хоолой хагарсан, засагдлаа",      materials: "Хоолой 3м, клип x4", daysAgo: 12, durationH: 6 },
  { issueType: "Тоолуур эвдэрсэн",    desc: "Тоолуур солигдлоо, тохируулгыг шинэчиллээ",  materials: "Тоолуур x1",         daysAgo: 18, durationH: 2 },
  { issueType: "Цахилгааны гэмтэл",   desc: "Залгуур гэмтсэн, шинэ залгуур тавигдлаа",   materials: "Залгуур x1",         daysAgo: 22, durationH: 3 },
  { issueType: "Дэлгэц ажиллахгүй",   desc: "Удирдлагын самбар шатсан, солигдлоо",        materials: "Самбар x1",          daysAgo: 30, durationH: 5 },
  { issueType: "Ус бохирдсон",        desc: "Шүүлтүүр угаагдаж, ариутгал хийгдлээ",       materials: "Хлор 2кг",           daysAgo: 35, durationH: 4 },
  { issueType: "Усны даралт бага",    desc: "Насос хуучирсан, шинэ насос суурилуулагдлаа", materials: "Насос x1",           daysAgo: 42, durationH: 8 },
];

function ago(days, offsetHours = 0) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(d.getHours() - offsetHours);
  return d.toISOString();
}

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const stations = (await client.query(
      "SELECT id, code FROM water_stations WHERE deleted_at IS NULL ORDER BY bag_no, code"
    )).rows;
    const teams    = (await client.query(
      "SELECT id, department_id FROM teams WHERE deleted_at IS NULL"
    )).rows;
    const users    = (await client.query(
      "SELECT id FROM users WHERE role='dispatcher' AND deleted_at IS NULL LIMIT 1"
    )).rows;

    if (!stations.length) { console.error("Станц олдсонгүй"); process.exit(1); }
    if (!teams.length)    { console.error("Бригад олдсонгүй"); process.exit(1); }

    const dispatcherId = users[0]?.id ?? null;

    // Pick up to 6 stations to spread history across
    const targets = stations.slice(0, Math.min(6, stations.length));
    let inserted = 0;

    for (let i = 0; i < HISTORY.length; i++) {
      const h       = HISTORY[i];
      const station = targets[i % targets.length];
      const team    = teams[i % teams.length];
      const now     = ago(h.daysAgo);
      const started = ago(h.daysAgo, h.durationH);
      const finished = now;

      const ticketId = randomUUID();
      const ticketNo = `TKT-HIST-${String(i + 1).padStart(3, "0")}`;
      const logId    = randomUUID();

      await client.query(
        `INSERT INTO tickets
           (id, ticket_no, station_id, department_id, team_id,
            issue_type, description, priority, status, source,
            created_by, assigned_by, assigned_at, created_at, started_at, finished_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'normal','done','phone',$8,$8,$9,$10,$11,$12)
         ON CONFLICT DO NOTHING`,
        [
          ticketId, ticketNo, station.id, team.department_id, team.id,
          h.issueType, h.desc,
          dispatcherId,
          started, now, started, finished,
        ]
      );

      await client.query(
        `INSERT INTO maintenance_logs
           (id, ticket_id, team_id, description, materials_used, started_at, finished_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT DO NOTHING`,
        [logId, ticketId, team.id, h.desc, h.materials, started, finished, finished]
      );

      console.log(`✓ ${station.code} — ${h.issueType} (${h.daysAgo} өдрийн өмнө)`);
      inserted++;
    }

    console.log(`\nНийт ${inserted} засварын түүх нэмэгдлээ.`);
  } finally {
    await client.end();
  }
})();
