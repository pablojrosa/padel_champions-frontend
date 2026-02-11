export type BlogPostSummary = {
  slug: string;
  tag: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  isPublished: boolean;
  coverImageSrc?: string;
  coverImageAlt?: string;
};

export type BlogSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type BlogPostDetail = BlogPostSummary & {
  coverImageSrc?: string;
  coverImageAlt?: string;
  sections: BlogSection[];
};

export const blogPostSummaries: BlogPostSummary[] = [
  {
    slug: "de-200-mensajes-whatsapp-a-1-link-torneo-padel-2026",
    tag: "ProvoPadel",
    title:
      "De 200 mensajes de WhatsApp a 1 solo link: así se organiza un torneo de pádel en 2026",
    excerpt:
      "Con ProvoPadel, los clubes pasan del caos en WhatsApp a una gestion centralizada de inscripciones, horarios, canchas y resultados.",
    date: "Feb 2026",
    readTime: "7 min",
    isPublished: true,
    coverImageSrc: "/blog/de-200-mensajes-whatsapp-a-1-link-torneo-padel-2026.png",
    coverImageAlt:
      "Organizador de torneo de padel con muchas planillas, mostrando el paso de cientos de mensajes a un solo link",
  },
  {
    slug: "futuro-torneos-padel-ya-llego-sin-excel",
    tag: "ProvoPadel",
    title: "El futuro de los torneos de pádel ya llegó (y no incluye Excel)",
    excerpt:
      "ProvoPadel centraliza inscripciones, horarios, canchas y resultados en tiempo real para que tu club organice torneos con menos caos y mas conversion.",
    date: "Feb 2026",
    readTime: "7 min",
    isPublished: true,
    coverImageSrc: "/blog/futuro-torneos-padel-ya-llego-sin-excel.png",
    coverImageAlt:
      "Organizador de club de padel con papeles y planillas, simbolizando el paso de Excel a una gestion moderna de torneos",
  },
  {
    slug: "gestion-torneos-padel-club-dificultades-reales",
    tag: "Gestion de clubes",
    title: "Gestion de torneos de padel en clubes: dificultades reales del dia a dia",
    excerpt:
      "Desde anunciar el torneo hasta coordinar horarios y canchas en pleno juego: los cuellos de botella que frenan a cualquier club.",
    date: "Feb 2026",
    readTime: "8 min",
    isPublished: true,
    coverImageSrc: "/blog/gestion-torneos-padel-club-dificultades-reales.png",
    coverImageAlt:
      "Organizador de torneo de padel con papeles y planillas en una cancha, reflejando el caos operativo del dia a dia",
  },
];

const blogPostDetails: Record<string, BlogPostDetail> = {
  "de-200-mensajes-whatsapp-a-1-link-torneo-padel-2026": {
    slug: "de-200-mensajes-whatsapp-a-1-link-torneo-padel-2026",
    tag: "ProvoPadel",
    title:
      "De 200 mensajes de WhatsApp a 1 solo link: así se organiza un torneo de pádel en 2026",
    excerpt:
      "Con ProvoPadel, los clubes pasan del caos en WhatsApp a una gestion centralizada de inscripciones, horarios, canchas y resultados.",
    date: "Feb 2026",
    readTime: "7 min",
    isPublished: true,
    coverImageSrc: "/blog/de-200-mensajes-whatsapp-a-1-link-torneo-padel-2026.png",
    coverImageAlt:
      "Organizador de torneo de padel con muchas planillas, mostrando el paso de cientos de mensajes a un solo link",
    sections: [
      {
        title: "El problema real: organizar torneos por WhatsApp no escala",
        paragraphs: [
          "Muchos clubes arrancan sus torneos de padel con buena energia y terminan con cientos de mensajes: inscripciones, cambios de horario, dudas de canchas, resultados y reclamos.",
          "Cuando toda la operacion vive en chats, se pierde tiempo, se duplican respuestas y aumenta el margen de error. El costo lo paga el equipo del club y tambien los jugadores.",
        ],
      },
      {
        title: "De 200 mensajes a 1 link: el cambio de modelo en 2026",
        paragraphs: [
          "En 2026, los torneos mejor gestionados comparten un patron: informacion centralizada y acceso simple para todos.",
          "Con ProvoPadel, en lugar de responder cada consulta por separado, compartis un solo link con el estado real del torneo.",
        ],
        bullets: [
          "Inscripciones de parejas en un mismo flujo.",
          "Cronograma con fecha, hora y cancha siempre actualizado.",
          "Resultados, posiciones y cruces visibles en tiempo real.",
          "Menos dependencia de mensajes manuales y capturas de pantalla.",
        ],
      },
      {
        title: "Como organiza un club su torneo con ProvoPadel",
        paragraphs: [
          "El proceso deja de ser artesanal y pasa a ser operativo. Desde el anuncio del torneo hasta el ultimo partido, cada fase queda ordenada dentro de la plataforma.",
        ],
        bullets: [
          "Publicas el torneo y definis categorias y cupos.",
          "Cargas parejas y restricciones horarias sin planillas paralelas.",
          "Programas partidos por fecha y cancha con trazabilidad.",
          "Actualizas resultados al instante y el cuadro se mantiene al dia.",
        ],
      },
      {
        title: "Beneficios para el club: menos friccion, mas crecimiento",
        paragraphs: [
          "Centralizar la gestion de torneos de padel no es solo una mejora operativa. Tambien impacta en negocio: mas orden, mejor imagen del club y mas capacidad de repetir eventos.",
          "Cuando los jugadores reciben informacion clara y confiable, aumenta la recompra para proximos torneos y mejora la recomendacion boca a boca.",
        ],
      },
      {
        title: "Beneficios para jugadores: experiencia clara y profesional",
        bullets: [
          "Saben donde y cuando juegan sin perseguir mensajes.",
          "Pueden seguir resultados y posiciones en un solo lugar.",
          "Reciben menos cambios confusos de ultimo momento.",
          "Perciben un torneo serio, moderno y bien organizado.",
        ],
      },
      {
        title: "Checklist rapido para pasar de WhatsApp a ProvoPadel",
        bullets: [
          "Define tu proximo torneo dentro de la plataforma.",
          "Centraliza inscripciones, horarios y canchas.",
          "Comparte un unico link con jugadores y staff.",
          "Mide cuantas consultas operativas se reducen en cada fecha.",
        ],
      },
      {
        title: "Conclusion",
        paragraphs: [
          "Si tu club sigue gestionando torneos entre chats y Excel, no estas solo: es el punto de partida de casi todos.",
          "La diferencia en 2026 la marca quien da el siguiente paso. Con ProvoPadel, pasas de 200 mensajes a 1 link y convertis caos en sistema.",
        ],
      },
    ],
  },
  "futuro-torneos-padel-ya-llego-sin-excel": {
    slug: "futuro-torneos-padel-ya-llego-sin-excel",
    tag: "ProvoPadel",
    title: "El futuro de los torneos de pádel ya llegó (y no incluye Excel)",
    excerpt:
      "ProvoPadel centraliza inscripciones, horarios, canchas y resultados en tiempo real para que tu club organice torneos con menos caos y mas conversion.",
    date: "Feb 2026",
    readTime: "7 min",
    isPublished: true,
    coverImageSrc: "/blog/futuro-torneos-padel-ya-llego-sin-excel.png",
    coverImageAlt:
      "Organizador de club de padel con papeles y planillas, simbolizando el paso de Excel a una gestion moderna de torneos",
    sections: [
      {
        title: "Excel fue util, pero ya no alcanza para gestionar torneos de padel",
        paragraphs: [
          "Si tu club sigue organizando torneos con planillas, chats y notas sueltas, el problema no es esfuerzo: es estructura. Hoy la gestion de torneos de padel exige velocidad, trazabilidad y comunicacion en tiempo real.",
          "Cuando todo depende de Excel, cualquier cambio de horario o cancha dispara errores en cadena. Eso se traduce en mas mensajes, mas reclamos y menos tiempo para hacer crecer el club.",
        ],
      },
      {
        title: "Que cambia cuando migras a ProvoPadel",
        paragraphs: [
          "ProvoPadel funciona como un centro operativo para clubes: desde el anuncio del torneo hasta el ultimo resultado, todo vive en un solo lugar.",
        ],
        bullets: [
          "Inscripcion de parejas ordenada por categoria y cupos.",
          "Programacion de partidos con fecha, hora y cancha sin rehacer planillas.",
          "Resultados y posiciones actualizados al instante para jugadores y organizadores.",
          "Menos consultas repetidas por WhatsApp gracias a informacion clara y compartible.",
        ],
      },
      {
        title: "Beneficio 1: menos caos operativo, mas control",
        paragraphs: [
          "Con ProvoPadel, el equipo del club deja de apagar incendios y pasa a operar con reglas claras. Cada accion queda visible: quien esta anotado, que partido sigue y que cancha esta ocupada.",
          "Esto reduce errores de coordinacion y mejora la experiencia del jugador, porque la informacion importante no se pierde entre mensajes.",
        ],
      },
      {
        title: "Beneficio 2: mejor experiencia para jugadores",
        paragraphs: [
          "Un torneo bien gestionado no solo se siente mas profesional: tambien genera confianza y fideliza a las parejas para la siguiente fecha.",
        ],
        bullets: [
          "Acceso simple a cruces, horarios y resultados.",
          "Menos incertidumbre sobre cambios de ultimo momento.",
          "Percepcion de club moderno y organizado.",
        ],
      },
      {
        title: "Beneficio 3: mas ingresos por torneos mejor ejecutados",
        paragraphs: [
          "Cuando la operacion deja de estar atada a Excel, el club puede lanzar mas torneos y sostener calidad en cada edicion.",
          "Mejor ejecucion significa mayor retencion de jugadores, mas recomendaciones y una base mas solida para monetizar categorias, sponsors y eventos especiales.",
        ],
      },
      {
        title: "Como empezar hoy en tu club",
        bullets: [
          "Publica tu proximo torneo desde ProvoPadel.",
          "Carga parejas y restricciones horarias en una sola plataforma.",
          "Comparte el link del torneo para reducir consultas manuales.",
          "Actualiza resultados en segundos y deja que el sistema haga el resto.",
        ],
      },
      {
        title: "Conclusion: el futuro ya llego",
        paragraphs: [
          "El futuro de los torneos de padel no pasa por trabajar mas horas, sino por trabajar con mejores herramientas.",
          "Si queres que tu club crezca con procesos profesionales y torneos escalables, ProvoPadel es el siguiente paso natural.",
        ],
      },
    ],
  },
  "gestion-torneos-padel-club-dificultades-reales": {
    slug: "gestion-torneos-padel-club-dificultades-reales",
    tag: "Gestion de clubes",
    title: "Gestion de torneos de padel en clubes: dificultades reales del dia a dia",
    excerpt:
      "Desde anunciar el torneo hasta coordinar horarios y canchas en pleno juego: los cuellos de botella que frenan a cualquier club.",
    date: "Feb 2026",
    readTime: "8 min",
    isPublished: true,
    coverImageSrc: "/blog/gestion-torneos-padel-club-dificultades-reales.png",
    coverImageAlt:
      "Organizador de torneo de padel con papeles y planillas en una cancha, reflejando el caos operativo del dia a dia",
    sections: [
      {
        title: "Por que organizar un torneo de padel en un club se vuelve tan complejo",
        paragraphs: [
          "Cuando se habla de gestion de torneos de padel, casi todos piensan en armar la grilla. Pero el trabajo real empieza mucho antes: anuncios, mensajes, pagos, cupos, horarios, cambios de ultima hora y resultados.",
          "En la practica, una sola persona termina coordinando todo. Si el proceso depende de planillas y WhatsApp, el torneo se vuelve una cadena de urgencias constante.",
        ],
      },
      {
        title: "Fase 1: anuncio del torneo y avalancha inicial de consultas",
        paragraphs: [
          "Publicar que se abre un torneo de padel en el club activa de inmediato decenas de preguntas repetidas: fecha, categoria, formato, costo, premios y disponibilidad.",
          "El problema no es responder una vez, sino responder lo mismo por varios canales y a diferentes horas, mientras llega nueva informacion que tambien hay que comunicar.",
        ],
        bullets: [
          "Mensajes duplicados en WhatsApp, Instagram y recepcion.",
          "Dudas sobre categorias y nivel real de cada pareja.",
          "Cambios de condiciones que no le llegan a todos al mismo tiempo.",
        ],
      },
      {
        title: "Fase 2: anotar parejas, validar datos y cerrar cupos sin errores",
        paragraphs: [
          "La inscripcion de parejas parece simple hasta que aparecen casos reales: jugadores anotados en mas de una categoria, datos incompletos, falta de pago o nombres cargados distinto en cada mensaje.",
          "Si no hay un flujo claro, el riesgo operativo crece: se sobrevende el cupo, se dejan parejas afuera por error o se confirman lugares sin respaldo.",
        ],
        bullets: [
          "Control manual de cupos por categoria.",
          "Seguimiento de pagos sin trazabilidad centralizada.",
          "Confirmaciones enviadas tarde o con datos inconsistentes.",
        ],
      },
      {
        title: "Fase 3: coordinar horarios y canchas con restricciones reales",
        paragraphs: [
          "Este es el punto critico de la organizacion de torneos de padel: transformar disponibilidad de jugadores y canchas en un cronograma jugable.",
          "Cada pareja trae restricciones horarias, el club tiene turnos ocupados, y ademas hay que respetar descansos razonables entre partidos para mantener la competitividad.",
        ],
        bullets: [
          "Parejas que solo pueden jugar en franjas especificas.",
          "Cantidad limitada de canchas para picos de demanda.",
          "Choques de horario que obligan a rehacer varias fechas.",
        ],
      },
      {
        title: "Fase 4: torneo en juego, mensajes urgentes y cambios en tiempo real",
        paragraphs: [
          "Cuando el torneo ya esta en curso, el volumen de mensajes se dispara: avisos de demora, pedidos de cambio, consultas por rivales, ubicacion de cancha y estado del cuadro.",
          "Si los resultados se cargan tarde o en distintos sistemas, los jugadores pierden confianza y el equipo del club queda atrapado resolviendo reclamos en lugar de operar el evento.",
        ],
        bullets: [
          "Reprogramaciones por demora o ausencia de jugadores.",
          "Actualizacion manual de resultados y posiciones.",
          "Necesidad de comunicar rapido para evitar confusiones.",
        ],
      },
      {
        title: "El costo silencioso para el club y su equipo",
        paragraphs: [
          "La mala gestion de torneos de padel no solo afecta el fin de semana del evento. Tambien impacta la reputacion del club, la experiencia del jugador y la posibilidad de vender nuevos torneos.",
          "Cuanto mas tiempo se va en tareas repetitivas, menos tiempo queda para mejorar servicio, sponsors y propuesta deportiva.",
        ],
      },
      {
        title: "Checklist operativo para gestionar mejor un torneo de padel",
        bullets: [
          "Centralizar inscripciones, pagos y estado de cada pareja en un solo lugar.",
          "Publicar reglas, fechas y categorias con mensajes unificados desde el inicio.",
          "Bloquear cupos automaticamente para evitar sobreinscripciones.",
          "Planificar partidos segun restricciones horarias y disponibilidad de canchas.",
          "Compartir resultados y cuadro actualizado en tiempo real para bajar consultas.",
        ],
      },
      {
        title: "Conclusion",
        paragraphs: [
          "Un torneo bien organizado no depende de trabajar mas horas, sino de tener un sistema de gestion que ordene cada fase.",
          "Si tu club sigue resolviendo todo por chat y planillas, el problema no es el equipo: es la herramienta. Estandarizar el proceso es lo que permite escalar torneos sin caos.",
        ],
      },
    ],
  },
};

export function getBlogPost(slug: string): BlogPostDetail | null {
  return blogPostDetails[slug] ?? null;
}

export function getPublishedBlogPosts(): BlogPostSummary[] {
  return blogPostSummaries.filter((post) => post.isPublished);
}
