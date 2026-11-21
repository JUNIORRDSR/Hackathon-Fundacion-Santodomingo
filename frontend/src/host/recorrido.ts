import { driver } from 'driver.js'
import type { Side } from 'driver.js'
import 'driver.js/dist/driver.css'
import './recorrido.css'

interface Paso {
  ruta?: string // la pantalla a la que lleva antes de señalar; sin ruta, se queda donde está
  elemento?: string // sin elemento, el paso se muestra al centro
  titulo: string
  texto: string
  lado?: Side
  soloAdmin?: boolean
}

// El recorrido por toda la app, en el orden del ciclo: pedir, asignar, recoger, validar, premiar y medir.
// Escanear se señala en el menú sin abrirlo, para no pedir la cámara a mitad del recorrido.
const PASOS: Paso[] = [
  {
    titulo: '¡Bienvenido a EcoConecta!',
    texto:
      'En un minuto te mostramos cómo se coordina la recolección de orgánicos y reciclables en Villas de San Pablo. ' +
      'Avanza con los botones o las flechas del teclado; Esc lo cierra.',
  },
  {
    ruta: '#/',
    elemento: '.main-nav',
    titulo: 'Tu menú',
    texto: 'Las secciones del día a día. Las demás viven en «Más».',
    lado: 'bottom',
  },
  {
    ruta: '#/',
    elemento: '.coordinator-profile',
    titulo: 'Tu equipo',
    texto:
      'Cada coordinación ve su colectivo: huerteros para los orgánicos y recicladores para los aprovechables. ' +
      'Desde aquí cambias de equipo.',
    lado: 'bottom',
  },
  {
    ruta: '#/',
    elemento: '.impacto',
    titulo: 'El impacto del mes',
    texto: 'Kilos validados, recolecciones, vecinos y puntos del barrio, con la gráfica por día y su Excel.',
    lado: 'bottom',
  },
  {
    ruta: '#/',
    elemento: '.stat-grid',
    titulo: 'Qué hacer hoy',
    texto:
      'Las tareas en orden de urgencia: kilos por validar, solicitudes por asignar, premios por entregar y vecinos ' +
      'nuevos. Toca una tarjeta para ir directo.',
    lado: 'top',
  },
  {
    ruta: '#/solicitudes',
    elemento: '.filter-bar',
    titulo: 'Solicitudes',
    texto:
      'Los pedidos llegan por WhatsApp. Abre uno, elige al encargado que sugiere el sistema, pon día y hora, y el ' +
      'vecino recibe el aviso.',
    lado: 'bottom',
  },
  {
    ruta: '#/recolecciones?vista=cronograma',
    elemento: '.timeline-panel',
    titulo: 'El cronograma del día',
    texto:
      'Cada fila es un recolector y cada bloque una visita, por hora. Toca un bloque para validar los kilos: el ' +
      'vecino gana sus puntos al instante.',
    lado: 'top',
  },
  {
    elemento: '.main-nav a[href="#/escanear"]',
    titulo: 'Escanear la bolsa',
    texto: 'En la huerta o el punto de acopio, escanea el QR del hogar con la tableta y registra el peso en segundos.',
    lado: 'bottom',
  },
  {
    ruta: '#/canjes',
    elemento: '.canje-vista',
    titulo: 'Canjes y premios',
    texto:
      'Los vecinos cambian sus puntos por premios. Aquí entregas los pedidos, mantienes el catálogo y la regla de ' +
      'puntos.',
    lado: 'bottom',
  },
  {
    ruta: '#/informes',
    elemento: '.indicadores',
    titulo: 'Informes para decidir',
    texto:
      'Las cifras del mes frente al anterior, la tendencia semanal, dónde rinde la ruta y cómo terminan los pedidos.',
    lado: 'bottom',
  },
  {
    ruta: '#/informes',
    elemento: '.lectura',
    titulo: 'Lectura rápida',
    texto: 'Frases calculadas con los mismos datos: qué zona aporta más, si el barrio crece y si conviene capacitar.',
    lado: 'top',
  },
  {
    ruta: '#/capacitacion',
    elemento: '.canecas',
    titulo: 'Capacitación',
    texto:
      'El código de colores, guías con avance, un juego y videos para enseñar a separar. Tiene una vista pública ' +
      'para compartir con los vecinos.',
    lado: 'top',
  },
  {
    ruta: '#/habilitar',
    elemento: '.canje-vista',
    titulo: 'Registros',
    texto: 'Acepta a los vecinos que se registran por WhatsApp y consulta vecinos, negocios y lugares del barrio.',
    lado: 'bottom',
  },
  {
    elemento: '.whatsapp-fab',
    titulo: 'Monitor de WhatsApp',
    texto: 'Las conversaciones del asistente con los vecinos, en vivo. Puedes responder tú cuando haga falta.',
    lado: 'top',
  },
  {
    elemento: '.topbar-configuracion',
    titulo: 'Configuración',
    texto: 'Las cuentas del equipo, el territorio y las rutas semanales.',
    lado: 'bottom',
    soloAdmin: true,
  },
  {
    ruta: '#/',
    elemento: '[data-recorrido="boton"]',
    titulo: '¡Listo!',
    texto: 'Repite este recorrido cuando quieras desde este botón.',
    lado: 'bottom',
  },
]
const VISTO = 'ecoconecta-recorrido-visto'

// Se ofrece solo la primera vez en cada navegador; sin almacenamiento disponible no insiste.
export function recorridoPendiente() {
  try {
    return !localStorage.getItem(VISTO)
  } catch {
    return false
  }
}

export function iniciarRecorrido(esAdmin: boolean) {
  try {
    localStorage.setItem(VISTO, '1')
  } catch {
    // Navegación privada: el recorrido sigue igual, solo que se volverá a ofrecer.
  }
  const pasos = PASOS.filter((paso) => esAdmin || !paso.soloAdmin)
  const ir = (indice: number) => {
    const ruta = pasos[indice]?.ruta
    if (ruta && window.location.hash !== ruta) window.location.hash = ruta
  }
  const recorrido = driver({
    showProgress: true,
    progressText: '{{current}} de {{total}}',
    nextBtnText: 'Siguiente',
    prevBtnText: 'Atrás',
    doneBtnText: 'Terminar',
    closeBtnLabel: 'Cerrar el recorrido',
    popoverClass: 'eco-recorrido',
    overlayColor: '#04291f',
    overlayOpacity: 0.62,
    stagePadding: 8,
    stageRadius: 18,
    smoothScroll: true,
    waitForElement: 6000, // la pantalla nueva entra con su transición y sus datos
    steps: pasos.map(({ elemento, titulo, texto, lado }) => ({
      element: elemento,
      popover: { title: titulo, description: texto, side: lado, align: 'start' },
    })),
    onNextClick: () => {
      const siguiente = (recorrido.getActiveIndex() ?? 0) + 1
      if (siguiente >= pasos.length) return recorrido.destroy()
      ir(siguiente)
      recorrido.moveNext()
    },
    onPrevClick: () => {
      ir((recorrido.getActiveIndex() ?? 1) - 1)
      recorrido.movePrevious()
    },
    // Las tarjetas cambian de tamaño cuando llegan sus datos: el recuadro se reacomoda después.
    onHighlighted: () =>
      [450, 1300].forEach((espera) => window.setTimeout(() => recorrido.isActive() && recorrido.refresh(), espera)),
  })
  recorrido.drive()
}
