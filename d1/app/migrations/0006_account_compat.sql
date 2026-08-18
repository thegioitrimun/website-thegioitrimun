PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO roles (id, code, name, created_at) VALUES
  ('role-master-admin', 'master_admin', 'Quản trị viên cấp cao', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('role-doctor', 'doctor', 'Bác sĩ', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

ALTER TABLE patient_profiles ADD COLUMN citizen_id_number TEXT;
ALTER TABLE patient_profiles ADD COLUMN nationality TEXT;
ALTER TABLE patient_profiles ADD COLUMN medical_history TEXT;
ALTER TABLE patient_profiles ADD COLUMN skin_type TEXT;
ALTER TABLE patient_profiles ADD COLUMN allergies TEXT;

CREATE INDEX IF NOT EXISTS patient_profiles_citizen_id_idx
  ON patient_profiles(citizen_id_number);
