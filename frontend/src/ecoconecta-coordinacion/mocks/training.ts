import type { TrainingResource } from '../types'

export const sampleTraining: TrainingResource[] = [
  {
    id: 'organicos',
    titulo: 'Residuos orgánicos',
    categoria: 'organico',
    tipo: 'guia',
    descripcion: 'Identifica los restos de origen vegetal que puedes separar en casa o en tu negocio.',
    pasos: [
      'Aparta cáscaras de frutas, restos de verduras y café usado.',
      'Retira bolsas, etiquetas y ligas antes de guardar los restos.',
      'Reserva un recipiente separado y mantenlo tapado.',
    ],
  },
  {
    id: 'aprovechables',
    titulo: 'Residuos aprovechables',
    categoria: 'aprovechable',
    tipo: 'guia',
    descripcion: 'Prepara los materiales que pueden recuperarse para que conserven su valor.',
    pasos: [
      'Separa papel y cartón secos, botellas plásticas, latas y envases de vidrio.',
      'Vacía y seca los envases antes de guardarlos.',
      'Confirma con el programa local qué materiales recibe.',
    ],
  },
  {
    id: 'mezclas',
    titulo: 'Qué evitar mezclar',
    categoria: 'mezclas',
    tipo: 'guia',
    descripcion: 'Mantén separados los materiales para facilitar el manejo de cada grupo.',
    pasos: [
      'Evita mezclar restos de comida con papel, cartón y envases.',
      'Mantén pañales, papel higiénico y servilletas sucias aparte.',
      'Separa pilas y residuos peligrosos para entregarlos en puntos habilitados.',
    ],
  },
  {
    id: 'practicas',
    titulo: 'Buenas prácticas',
    categoria: 'practicas',
    tipo: 'guia',
    descripcion: 'Adopta hábitos sencillos para mantener ordenado el lugar donde separas.',
    pasos: [
      'Usa recipientes identificados y fáciles de limpiar.',
      'Acuerda con tu hogar o negocio dónde va cada grupo.',
      'Mantén los residuos protegidos de la lluvia hasta la entrega.',
    ],
  },
  {
    id: 'video-intro',
    titulo: 'Cómo separar tus residuos',
    categoria: 'practicas',
    tipo: 'video',
    descripcion: 'Video breve de aproximadamente 30 segundos.',
  },
]
