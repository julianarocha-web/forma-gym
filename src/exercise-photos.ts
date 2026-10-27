// Image aliases only help choose a photograph. Exercise/history identity remains the UUID.
export const exercisePhotos = [
  {
    id: "squat",
    label: "Sentadilla con barra",
    names: [
      "sentadilla",
      "sentadilla con barra",
      "sentadilla libre",
      "barbell squat",
    ],
    position: "28% 80%",
  },
  {
    id: "press",
    label: "Prensa de piernas",
    names: ["prensa", "prensa de piernas", "prensa horizontal", "leg press"],
    position: "50% 55%",
  },
  {
    id: "romanian",
    label: "Peso muerto rumano",
    names: ["peso muerto rumano", "romanian deadlift", "rdl"],
    position: "40% 55%",
  },
  {
    id: "extension",
    label: "Extensión de cuádriceps",
    names: [
      "extension de cuadriceps",
      "extension de piernas",
      "sillon de cuadriceps",
      "leg extension",
    ],
    position: "50% 64%",
  },
  {
    id: "curl",
    label: "Curl femoral",
    names: [
      "curl femoral",
      "curl femoral acostado",
      "curl femoral tumbado",
      "camilla de isquiotibiales",
      "lying leg curl",
    ],
    position: "50% 50%",
    extension: "jpg",
    credit: {
      author: "GeorgeStepanek",
      url: "https://commons.wikimedia.org/wiki/File:LyingLegCurlMachineExercise.JPG",
      license: "CC BY-SA 3.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    },
  },
  {
    id: "bike",
    label: "Bicicleta fija",
    names: [
      "bicicleta",
      "bicicleta minutos",
      "bicicleta fija",
      "bicicleta estatica",
      "bici fija",
      "stationary bike",
    ],
    position: "50% 50%",
  },
  {
    id: "bench",
    label: "Press de banca",
    names: [
      "press de banca",
      "press banca",
      "press de pecho con barra",
      "bench press",
    ],
    position: "50% 60%",
  },
  {
    id: "fly",
    label: "Aperturas con mancuernas",
    names: [
      "aperturas con mancuernas",
      "aperturas de pecho",
      "dumbbell fly",
      "chest fly",
    ],
    position: "50% 56%",
  },
  {
    id: "crunch",
    label: "Crunch abdominal",
    names: ["crunch", "crunch abdominal", "abdominales", "abdominales cortos"],
    position: "50% 60%",
  },
  {
    id: "row",
    label: "Remo con barra",
    names: [
      "remo con barra",
      "remo inclinado con barra",
      "barbell row",
      "bent over row",
    ],
    position: "50% 50%",
    extension: "jpg",
    credit: {
      author: "Em Bhoo",
      url: "https://commons.wikimedia.org/wiki/File:Barbell_row.jpg",
      license: "CC BY 2.0",
      licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    },
  },
  {
    id: "pulldown",
    label: "Jalón al pecho",
    names: [
      "jalon al pecho",
      "jalones al pecho",
      "lat pulldown",
      "polea al pecho",
    ],
    position: "45% 35%",
  },
  {
    id: "shoulder",
    label: "Press de hombros",
    names: [
      "press de hombros",
      "press de hombros con mancuernas",
      "shoulder press",
    ],
    position: "50% 40%",
  },
  {
    id: "biceps",
    label: "Curl de bíceps",
    names: [
      "curl de biceps",
      "curl biceps",
      "curl de biceps con mancuernas",
      "curl con mancuernas",
      "biceps curl",
    ],
    position: "42% 48%",
  },
  {
    id: "hip",
    label: "Hip thrust",
    names: [
      "hip thrust",
      "hip thrust con barra",
      "empuje de cadera",
      "elevacion de cadera con barra",
    ],
    position: "55% 48%",
  },
  {
    id: "sumo",
    label: "Sentadilla sumo",
    names: ["sentadilla sumo", "sentadillas sumo", "sumo squat"],
    position: "50% 60%",
  },
  {
    id: "kick",
    label: "Patada de glúteo",
    names: [
      "patada de gluteo",
      "patada de gluteos",
      "donkey kick",
      "patada de gluteo en cuadrupedia",
    ],
    position: "52% 60%",
  },
  {
    id: "abduction",
    label: "Abducción de cadera",
    names: [
      "abduccion de cadera",
      "abducciones de cadera",
      "abductores en maquina",
      "maquina de abductores",
      "hip abduction",
    ],
    position: "80% 55%",
  },
  {
    id: "smith",
    label: "Sentadilla en Smith",
    names: [
      "sentadilla smith",
      "sentadilla en smith",
      "sentadilla en maquina smith",
      "sentadillas smith",
      "smith squat",
    ],
    position: "50% 60%",
  },
  {
    id: "bulgarian",
    label: "Sentadilla búlgara",
    names: [
      "sentadilla bulgara",
      "sentadillas bulgaras",
      "bulgarian split squat",
      "sentadilla bulgara con mancuernas",
    ],
    position: "50% 55%",
  },
  {
    id: "triceps",
    label: "Extensión de tríceps en polea",
    names: [
      "extension de triceps en polea",
      "extension de triceps con cuerda",
      "triceps en polea",
      "triceps con cuerda",
      "triceps pushdown",
    ],
    position: "50% 55%",
  },
  {
    id: "seated-curl",
    label: "Curl femoral sentado",
    names: [
      "curl femoral sentado",
      "curl de piernas sentado",
      "seated leg curl",
    ],
    position: "50% 50%",
    extension: "jpg",
  },
] as const;

export const normalizePhotoName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
