export type BlogPostSummary = {
  slug: string;
  tag: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  isPublished: boolean;
};

export type BlogSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type BlogPostDetail = BlogPostSummary & {
  sections: BlogSection[];
};

export const blogPostSummaries: BlogPostSummary[] = [
  {
    slug: "rutina-express-bandeja",
    tag: "Entrenamiento",
    title: "Rutina express para mejorar tu bandeja",
    excerpt: "Ejercicios simples para ganar control y profundidad en la bandeja.",
    date: "Abr 2024",
    readTime: "6 min",
    isPublished: true,
  },
  {
    slug: "dominar-globo-cuando-te-atacan",
    tag: "Tactica",
    title: "Como dominar el globo cuando te atacan",
    excerpt: "Claves para recuperar la red y convertir defensa en ataque.",
    date: "Abr 2024",
    readTime: "4 min",
    isPublished: true,
  },
  {
    slug: "pala-grip-calzado-checklist",
    tag: "Equipamiento",
    title: "Pala, grip y calzado: que revisar antes de competir",
    excerpt: "Checklist rapido para llegar a cada partido con la mejor sensacion.",
    date: "Mar 2024",
    readTime: "5 min",
    isPublished: true,
  },
];

const blogPostDetails: Record<string, BlogPostDetail> = {
  "rutina-express-bandeja": {
    slug: "rutina-express-bandeja",
    tag: "Entrenamiento",
    title: "Rutina express para mejorar tu bandeja",
    excerpt: "Ejercicios simples para ganar control y profundidad en la bandeja.",
    date: "Abr 2024",
    readTime: "6 min",
    isPublished: true,
    sections: [
      {
        title: "Por que esta rutina funciona",
        paragraphs: [
          "La bandeja es un golpe de control. Mantiene la red, evita regalar pelotas y te da tiempo para volver a posicionarte.",
          "Esta rutina express se enfoca en tres cosas: punto de impacto, direccion y transicion rapida a la red.",
        ],
      },
      {
        title: "Calentamiento (3 minutos)",
        bullets: [
          "1 min de peloteo suave con bandejas a medio swing.",
          "1 min de movilidad de hombros, codo y muneca con la pala.",
          "1 min de pasos cortos: split-step, ajuste lateral y salida.",
        ],
      },
      {
        title: "Bloque tecnico (8 minutos)",
        paragraphs: [
          "Busca impacto delante del cuerpo y acompana la pelota con un gesto corto.",
          "Prioriza altura segura: de la cintura al hombro. Lo importante es que la bola suba y caiga profunda.",
        ],
        bullets: [
          "4 min de bandejas cruzadas: 10 bolas a la esquina, 10 a la reja lateral.",
          "4 min de bandejas paralelas: apunta a la T para cortar el angulo.",
        ],
      },
      {
        title: "Bloque de precision (6 minutos)",
        bullets: [
          "Coloca una toalla o cono en la zona de servicio rival y apunta 8 de 12 bolas.",
          "Alterna profundidad: 1 bola corta, 1 bola profunda, sin perder altura.",
          "Termina con 6 bandejas a objetivo reducido (la linea de saque).",
        ],
      },
      {
        title: "Cierre y checklist (2 minutos)",
        bullets: [
          "Impacto delante del cuerpo, pala estable y mirada fija en el punto de contacto.",
          "Recupera la red en dos pasos: golpeo + avance.",
          "Respira y repite el gesto corto cuando sientas que apuras el swing.",
        ],
      },
      {
        title: "Errores frecuentes",
        bullets: [
          "Golpear atras del cuerpo y perder control.",
          "Buscar potencia en lugar de direccion.",
          "Quedarse parado despues del golpe.",
        ],
      },
    ],
  },
  "dominar-globo-cuando-te-atacan": {
    slug: "dominar-globo-cuando-te-atacan",
    tag: "Tactica",
    title: "Como dominar el globo cuando te atacan",
    excerpt: "Claves para recuperar la red y convertir defensa en ataque.",
    date: "Abr 2024",
    readTime: "4 min",
    isPublished: true,
    sections: [
      {
        title: "La idea clave: ganar tiempo",
        paragraphs: [
          "El globo defensivo no es para escapar, es para recuperar la red.",
          "Si la bola viaja alta y profunda, obligas al rival a retroceder y te da segundos para avanzar.",
        ],
      },
      {
        title: "Cuando usarlo",
        bullets: [
          "Cuando te atacan con volea agresiva y no llegas a la altura ideal.",
          "Si quedas atrapado en la reja y necesitas resetear el punto.",
          "Luego de una bola baja: el globo es el golpe mas seguro.",
        ],
      },
      {
        title: "Tecnica rapida",
        bullets: [
          "Impacto por delante del cuerpo y pala abierta.",
          "Swing corto y ascendente, termina con la pala arriba.",
          "Busca un arco alto; no pienses en velocidad, piensa en altura.",
        ],
      },
      {
        title: "Ubicacion y direccion",
        paragraphs: [
          "Apunta al centro para reducir angulos o al fondo cruzado si el rival esta pegado a la reja.",
          "Evita dejarla corta: un globo corto es un remate seguro.",
        ],
      },
      {
        title: "Ejercicio express (6 minutos)",
        bullets: [
          "3 min de globos a la esquina rival, alternando cruzado y paralelo.",
          "3 min de globo + avance: golpea y sube en dos pasos a la red.",
        ],
      },
      {
        title: "Errores frecuentes",
        bullets: [
          "Golpear tarde y dejar la bola baja.",
          "Mirar al rival en lugar de fijar el punto de impacto.",
          "No avanzar despues del globo.",
        ],
      },
    ],
  },
  "pala-grip-calzado-checklist": {
    slug: "pala-grip-calzado-checklist",
    tag: "Equipamiento",
    title: "Pala, grip y calzado: que revisar antes de competir",
    excerpt: "Checklist rapido para llegar a cada partido con la mejor sensacion.",
    date: "Mar 2024",
    readTime: "5 min",
    isPublished: true,
    sections: [
      {
        title: "Antes de salir de casa",
        bullets: [
          "Revisa que tu pala no tenga fisuras ni bordes levantados.",
          "Lleva un overgrip extra y una munequera de repuesto.",
          "Chequea que tengas toalla y botella con agua.",
        ],
      },
      {
        title: "Pala: estado y equilibrio",
        paragraphs: [
          "Un marco dañado cambia el balance y la salida de bola.",
          "Si sentis vibraciones raras, ajusta el protector o considera un cambio.",
        ],
        bullets: [
          "Golpea suave con los dedos: sonido uniforme = ok.",
          "Controla el peso: si agregaste overgrips, ajusta tu sensacion.",
        ],
      },
      {
        title: "Grip: agarre firme, mano relajada",
        bullets: [
          "Si el grip resbala, pierdes control en la bandeja y la volea.",
          "Cambia el overgrip cada 3 o 4 partidos si transpirás mucho.",
          "Usa polvo o toalla para secar la mano entre puntos.",
        ],
      },
      {
        title: "Calzado: seguridad en cada apoyo",
        paragraphs: [
          "Las suelas gastadas reducen la traccion y aumentan el riesgo de torceduras.",
        ],
        bullets: [
          "Verifica que no haya zonas lisas ni deformadas.",
          "Ajusta bien los cordones antes de entrar a la cancha.",
        ],
      },
      {
        title: "Mini rutina previa (4 minutos)",
        bullets: [
          "1 min de movilidad de tobillos y rodillas.",
          "1 min de swings suaves para activar hombros.",
          "2 min de peloteo corto con bandejas y voleas.",
        ],
      },
    ],
  },
};

export function getBlogPost(slug: string): BlogPostDetail | null {
  return blogPostDetails[slug] ?? null;
}
