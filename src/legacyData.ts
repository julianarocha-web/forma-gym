export type Exercise = {
  id: string;
  name: string;
  muscle: string;
  sets: number;
  reps: number;
  weight: number;
};
export type Routine = {
  id: string;
  day: string;
  weekday: number;
  name: string;
  subtitle: string;
  exercises: Exercise[];
};
const exercise = (
  id: string,
  name: string,
  muscle: string,
  sets: number,
  reps: number,
  weight: number,
): Exercise => ({ id, name, muscle, sets, reps, weight });
export const initialRoutines: Routine[] = [
  {
    id: "legs",
    day: "Lunes",
    weekday: 1,
    name: "Piernas",
    subtitle: "Construí una base fuerte.",
    exercises: [
      exercise(
        "squat",
        "Sentadilla con barra",
        "Cuádriceps · Glúteos",
        4,
        10,
        40,
      ),
      exercise("press", "Prensa de piernas", "Cuádriceps", 3, 12, 80),
      exercise(
        "romanian",
        "Peso muerto rumano",
        "Isquiotibiales · Glúteos",
        3,
        10,
        30,
      ),
      exercise("extension", "Extensión de cuádriceps", "Cuádriceps", 3, 15, 25),
      exercise("curl", "Curl femoral", "Isquiotibiales", 3, 12, 20),
    ],
  },
  {
    id: "chest",
    day: "Martes",
    weekday: 2,
    name: "Cardio, pecho y abdomen",
    subtitle: "Energía y resistencia.",
    exercises: [
      exercise(
        "bike",
        "Bicicleta · minutos",
        "Cardio · Repeticiones = minutos",
        1,
        20,
        0,
      ),
      exercise("bench", "Press de banca", "Pecho · Tríceps", 4, 10, 25),
      exercise("fly", "Aperturas con mancuernas", "Pecho", 3, 12, 8),
      exercise("crunch", "Crunch abdominal", "Abdomen", 3, 20, 0),
    ],
  },
  {
    id: "upper",
    day: "Miércoles",
    weekday: 3,
    name: "Tren superior",
    subtitle: "Más fuerza en cada movimiento.",
    exercises: [
      exercise("row", "Remo con barra", "Espalda", 4, 10, 25),
      exercise("pulldown", "Jalón al pecho", "Espalda · Bíceps", 3, 12, 30),
      exercise("shoulder", "Press de hombros", "Hombros", 3, 10, 10),
      exercise("biceps", "Curl de bíceps", "Bíceps", 3, 12, 8),
    ],
  },
  {
    id: "glutes",
    day: "Viernes",
    weekday: 5,
    name: "Glúteos",
    subtitle: "Un paso más hacia tu objetivo.",
    exercises: [
      exercise("hip", "Hip thrust", "Glúteos", 4, 12, 50),
      exercise("sumo", "Sentadilla sumo", "Glúteos · Aductores", 3, 12, 20),
      exercise("kick", "Patada de glúteo", "Glúteos", 3, 15, 10),
      exercise("abduction", "Abducción de cadera", "Glúteos", 3, 15, 25),
    ],
  },
];
