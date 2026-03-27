alter table user_settings
  add column increments jsonb default '{"Squat":2.5,"Bench Press":2.5,"Barbell Row":2.5,"Overhead Press":2.5,"Deadlift":5}';
