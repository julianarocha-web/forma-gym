-- Read-only general catalog. User edits are private copies in forma_exercises.
begin;
insert into public.forma_shared_exercises(id,name,activity_type,tags,image) values
('squat','Sentadilla con barra','strength',array['Cuádriceps','Glúteos','Barra'],'{"kind":"asset","id":"exercise-squat"}'),
('press','Prensa de piernas','strength',array['Cuádriceps','Máquina'],'{"kind":"asset","id":"exercise-press"}'),
('romanian','Peso muerto rumano','strength',array['Isquiotibiales','Glúteos','Barra'],'{"kind":"asset","id":"exercise-romanian"}'),
('extension','Extensión de cuádriceps','strength',array['Cuádriceps','Máquina'],'{"kind":"asset","id":"exercise-extension"}'),
('curl','Curl femoral','strength',array['Isquiotibiales','Máquina'],'{"kind":"asset","id":"exercise-curl"}'),
('bike','Bicicleta fija','cardio',array['Aeróbico','Bicicleta'],'{"kind":"asset","id":"exercise-bike"}'),
('bench','Press de banca','strength',array['Pecho','Tríceps','Barra'],'{"kind":"asset","id":"exercise-bench"}'),
('fly','Aperturas con mancuernas','strength',array['Pecho','Mancuernas'],'{"kind":"asset","id":"exercise-fly"}'),
('crunch','Crunch abdominal','strength',array['Abdomen','Peso corporal'],'{"kind":"asset","id":"exercise-crunch"}'),
('row','Remo con barra','strength',array['Espalda','Barra'],'{"kind":"asset","id":"exercise-row"}'),
('pulldown','Jalón al pecho','strength',array['Espalda','Bíceps','Polea'],'{"kind":"asset","id":"exercise-pulldown"}'),
('shoulder','Press de hombros','strength',array['Hombros','Mancuernas'],'{"kind":"asset","id":"exercise-shoulder"}'),
('biceps','Curl de bíceps','strength',array['Bíceps','Mancuernas'],'{"kind":"asset","id":"exercise-biceps"}'),
('hip','Hip thrust','strength',array['Glúteos','Barra'],'{"kind":"asset","id":"exercise-hip"}'),
('sumo','Sentadilla sumo','strength',array['Glúteos','Aductores'],'{"kind":"asset","id":"exercise-sumo"}'),
('kick','Patada de glúteo','strength',array['Glúteos','Peso corporal'],'{"kind":"asset","id":"exercise-kick"}'),
('abduction','Abducción de cadera','strength',array['Glúteos','Máquina'],'{"kind":"asset","id":"exercise-abduction"}')
on conflict(id) do nothing;
commit;
