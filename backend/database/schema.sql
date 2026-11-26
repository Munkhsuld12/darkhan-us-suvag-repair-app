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
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin','dispatcher','general_engineer','department_engineer','brigade_leader','worker')),
  department_id VARCHAR(100) REFERENCES departments(id) ON DELETE SET NULL,
  team_id VARCHAR(100) REFERENCES teams(id) ON DELETE SET NULL,
  phone VARCHAR(30),
  email VARCHAR(255),
  profile_complete BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id VARCHAR(100) PRIMARY KEY,
  user_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  edit_token VARCHAR(255) UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new','converted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_label VARCHAR(255) DEFAULT ''
);

ALTER TABLE complaints ADD COLUMN IF NOT EXISTS edit_token VARCHAR(255) UNIQUE;

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
  worker_id VARCHAR(100)
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
CREATE INDEX IF NOT EXISTS idx_complaints_edit_token ON complaints(edit_token);
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
CREATE INDEX IF NOT EXISTS idx_password_reset_token  ON password_reset_tokens(token);

-- Brigade workers (not system users, managed by brigade leader)
CREATE TABLE IF NOT EXISTS workers (
  id VARCHAR(100) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(30) DEFAULT '',
  position VARCHAR(255) DEFAULT '',
  team_id VARCHAR(100) REFERENCES teams(id) ON DELETE SET NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workers_team ON workers(team_id);
CREATE INDEX IF NOT EXISTS idx_ticket_workers_ticket ON ticket_workers(ticket_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_workers' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE ticket_workers DROP CONSTRAINT IF EXISTS ticket_workers_user_id_fkey;
    ALTER TABLE ticket_workers RENAME COLUMN user_id TO worker_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ticket_workers_worker_id_fkey'
  ) THEN
    ALTER TABLE ticket_workers
      ADD CONSTRAINT ticket_workers_worker_id_fkey
      FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ticket_workers_worker ON ticket_workers(worker_id);


-- Нууц үг солигдсон хугацаа: үүнээс өмнө олгогдсон JWT хүчингүй болно.
-- Trigger нь password_hash өөрчлөгдөх бүрт (ямар ч кодоос) автоматаар шинэчилнэ.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE OR REPLACE FUNCTION users_set_password_changed_at() RETURNS trigger AS $$
BEGIN
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
    NEW.password_changed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_password_changed_at ON users;
CREATE TRIGGER trg_users_password_changed_at
  BEFORE UPDATE OF password_hash ON users
  FOR EACH ROW EXECUTE FUNCTION users_set_password_changed_at();

CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
