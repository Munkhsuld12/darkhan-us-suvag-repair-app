// Mongolian constants — kept in sync with backend seed data

export const issueTypeOptions = [
  "Насос ажиллахгүй",
  "Дэлгэц ажиллахгүй",
  "Цахилгааны асуудал",
  "Ус гоожиж байна",
  "Хаалга/цоож эвдэрсэн",
  "Бусад",
];

export const statusLabels = {
  new:         "Шинэ",
  assigned:    "Хуваарилсан",
  urgent:      "Яаралтай",
  in_progress: "Явцдаа",
  done:        "Дууссан",
};

export const priorityLabels = {
  normal: "Энгийн",
  urgent: "Яаралтай",
};

export const sourceLabels = {
  web:   "Вэб",
  phone: "Утас",
};

export const complaintStatusLabels = {
  new:       "Шинэ",
  converted: "Хөрвүүлсэн",
};

export const roleLabels = {
  admin:                "Админ",
  dispatcher:           "Диспетчер",
  general_engineer:     "Ерөнхий инженер",
  department_engineer:  "Хэлтсийн инженер",
  brigade_leader:       "Багийн ахлагч",
};

export const reportTypeLabels = {
  complaints:  "Гомдол",
  tickets:     "Засварын хүсэлт",
  tasks:       "Өдөр тутмын ажил",
  maintenance: "Засварын түүх",
  performance: "Гүйцэтгэлийн тойм",
};

export const roleOptions = [
  "admin",
  "dispatcher",
  "general_engineer",
  "department_engineer",
  "brigade_leader",
];
