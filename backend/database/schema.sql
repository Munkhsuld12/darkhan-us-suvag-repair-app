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

-- Admin audit logs
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id VARCHAR(100) PRIMARY KEY,
  user_id VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_complaints_station    ON complaints(station_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status     ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_tickets_station       ON tickets(station_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status        ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_team          ON tickets(team_id);
CREATE INDEX IF NOT EXISTS idx_tickets_dept          ON tickets(department_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created       ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_team            ON tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_dept            ON tasks(department_id);
CREATE INDEX IF NOT EXISTS idx_tasks_date            ON tasks(task_date);
CREATE INDEX IF NOT EXISTS idx_ticket_logs_ticket    ON ticket_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_ticket    ON maintenance_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_task      ON maintenance_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_water_stations_bag    ON water_stations(bag_no);
CREATE INDEX IF NOT EXISTS idx_water_stations_code   ON water_stations(code);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created    ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user       ON admin_audit_logs(user_id);
