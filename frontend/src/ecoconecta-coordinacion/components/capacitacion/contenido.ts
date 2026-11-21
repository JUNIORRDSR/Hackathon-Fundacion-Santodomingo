// Material fijo de la capacitación: el código de colores, los videos, los carteles y el juego «¿Dónde va?».

export type Caneca = 'blanca' | 'verde' | 'negra'

// Código de colores nacional para separar en la fuente (Resolución 2184 de 2019, vigente desde 2021).
export const canecas: { id: Caneca; nombre: string; que: string; destino: string; ejemplos: string[] }[] = [
  {
    id: 'verde',
    nombre: 'Caneca verde',
    que: 'Orgánicos aprovechables',
    destino: 'Los recogen los huerteros y vuelven abono en la huerta.',
    ejemplos: [
      'Cáscaras de frutas y verduras',
      'Restos de comida sin hueso',
      'Borra de café y bolsitas de té',
      'Hojas y poda',
    ],
  },
  {
    id: 'blanca',
    nombre: 'Caneca blanca',
    que: 'Aprovechables',
    destino: 'Los recogen los recicladores de oficio. Entrégalos limpios y secos.',
    ejemplos: ['Botellas y envases plásticos', 'Papel y cartón secos', 'Latas y metales', 'Vidrio y envases Tetra Pak'],
  },
  {
    id: 'negra',
    nombre: 'Caneca negra',
    que: 'No aprovechables',
    destino: 'Van a la recolección ordinaria del aseo, nunca a la huerta.',
    ejemplos: [
      'Papel higiénico y servilletas',
      'Pañales y toallas higiénicas',
      'Cartón o papel con grasa',
      'Empaques metalizados',
    ],
  },
]

// Videos públicos de YouTube, revisados: existen y permiten verse dentro de la página.
export const videos = [
  {
    id: 'JWiLqD5ch8o',
    titulo: '¿Sabes cómo separar con el nuevo código de colores?',
    fuente: 'Corantioquia',
    tema: 'Separación',
  },
  {
    id: 'r2lb8dVBX50',
    titulo: 'Cómo hacer compost con residuos orgánicos',
    fuente: 'Estela de Vidaverdi',
    tema: 'Compost',
  },
  {
    id: '9nXFK8Ykk-w',
    titulo: '¿Sabe reciclar? Aprenda por qué es un deber',
    fuente: 'Confederación Colombiana de Consumidores',
    tema: 'Reciclaje',
  },
  {
    id: 'tvOQxukmp9E',
    titulo: 'Más allá de los residuos: la labor de los recicladores',
    fuente: 'El Espectador',
    tema: 'Oficio',
  },
]

// Los mismos carteles que el agente de WhatsApp manda a los vecinos (ADR-0016); la API los sirve en público.
const CARTELES = '/api/whatsapp/carteles/'
export const carteles = [
  { archivo: 'tipos-de-residuos.jpg', titulo: 'Tipos de residuos', texto: 'Qué es orgánico y qué es aprovechable' },
  { archivo: 'organicos-si-y-no.jpg', titulo: 'Orgánicos: sí y no', texto: 'Lo que la huerta recibe y lo que no' },
  { archivo: 'aprovechables-si-y-no.jpg', titulo: 'Aprovechables: sí y no', texto: 'Lo que el reciclador recibe' },
  { archivo: 'tips-para-reciclar.jpg', titulo: 'Seis tips para reciclar', texto: 'Limpios, secos y aplastados' },
  { archivo: 'como-solicitar.jpg', titulo: 'Cómo pedir la recolección', texto: 'Paso a paso por WhatsApp' },
  { archivo: 'por-que-separar.jpg', titulo: 'Por qué separar', texto: 'Beneficios para el hogar y el barrio' },
].map((cartel) => ({ ...cartel, url: CARTELES + cartel.archivo }))

// El juego «¿Dónde va?»: cada objeto con su caneca y el porqué, para aprender del error y no solo del acierto.
export const objetos: { nombre: string; emoji: string; caneca: Caneca; porque: string }[] = [
  { nombre: 'Cáscara de banano', emoji: '🍌', caneca: 'verde', porque: 'Es orgánico: en la huerta se vuelve abono.' },
  {
    nombre: 'Botella plástica limpia',
    emoji: '🧴',
    caneca: 'blanca',
    porque: 'Es aprovechable. Enjuágala y aplástala.',
  },
  { nombre: 'Servilleta usada', emoji: '🧻', caneca: 'negra', porque: 'Está sucia: ya no se puede aprovechar.' },
  {
    nombre: 'Borra de café',
    emoji: '☕',
    caneca: 'verde',
    porque: 'Es orgánica y a las lombrices de la huerta les encanta.',
  },
  { nombre: 'Caja de cartón seca', emoji: '📦', caneca: 'blanca', porque: 'Seca y aplanada conserva su valor.' },
  { nombre: 'Caja de pizza con grasa', emoji: '🍕', caneca: 'negra', porque: 'El cartón con grasa no se recicla.' },
  {
    nombre: 'Lata de atún lavada',
    emoji: '🥫',
    caneca: 'blanca',
    porque: 'El metal limpio se recicla una y otra vez.',
  },
  { nombre: 'Cáscaras de huevo', emoji: '🥚', caneca: 'verde', porque: 'Son orgánicas y aportan calcio al compost.' },
  {
    nombre: 'Paquete de papas metalizado',
    emoji: '🍟',
    caneca: 'negra',
    porque: 'Los empaques metalizados no se aprovechan.',
  },
  { nombre: 'Botella de vidrio', emoji: '🍾', caneca: 'blanca', porque: 'El vidrio limpio es aprovechable.' },
]
