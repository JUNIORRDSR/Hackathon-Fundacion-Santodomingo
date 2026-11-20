import { localDate } from '../labels'
import type { Collector, Coordinator, Request, RequestStatus, WasteType } from '../types'

export const demoCoordinators: Coordinator[] = [
  { id: 'demo-huerteros', nombre: 'Lucía Herrera', grupo: 'organico' },
  { id: 'demo-recicladores', nombre: 'Andrés Duarte', grupo: 'aprovechable' },
]

export function createDemoData() {
  const collectors: Collector[] = [
    { id: 'H-01', nombre: 'Marta Salcedo', grupo: 'organico', zona: 'Corredor comercial', activo: true },
    { id: 'H-02', nombre: 'José Rincón', grupo: 'organico', zona: 'Brisas de San Pablo', activo: true },
    { id: 'H-03', nombre: 'Camila Torres', grupo: 'organico', zona: 'Brisas de San Pablo', activo: true },
    { id: 'H-04', nombre: 'Elena Rojas', grupo: 'organico', zona: 'Corredor comercial', activo: true },
    { id: 'H-05', nombre: 'Hugo Pineda', grupo: 'organico', zona: 'Brisas de San Pablo', activo: true },
    { id: 'R-01', nombre: 'Daniel Montes', grupo: 'aprovechable', zona: 'Brisas de San Pablo', activo: true },
    { id: 'R-02', nombre: 'Rosa Mendoza', grupo: 'aprovechable', zona: 'Corredor comercial', activo: true },
    { id: 'R-03', nombre: 'Elena Correa', grupo: 'aprovechable', zona: 'Brisas de San Pablo', activo: false },
  ]

  function seed(
    number: number,
    solicitante: string,
    ubicacion: string,
    offset: number,
    estado: RequestStatus,
    tipo: WasteType = 'organico',
    recolectorId = 'H-01',
    programada = 0,
    pesoKg = 5,
    hora?: string,
  ): Request {
    const id = 'EC-' + number
    const details = { id, solicitante, ubicacion, tipo, fecha: localDate(offset) }
    const asignacion = { solicitudId: id, recolectorId, fecha: localDate(programada), ...(hora ? { hora } : {}) }
    switch (estado) {
      case 'pendiente':
        return { ...details, estado }
      case 'asignada':
        return { ...details, estado, asignacion }
      case 'recolectada':
        return { ...details, estado, asignacion, resultado: { solicitudId: id, estado, pesoKg } }
      case 'rechazada':
        return {
          ...details,
          estado,
          asignacion,
          resultado: { solicitudId: id, estado, motivoRechazo: 'El material venía mezclado con otros residuos.' },
        }
    }
  }

  const requests: Request[] = [
    seed(124, 'Cocina La Esquina', 'Corredor comercial', 0, 'pendiente'),
    seed(123, 'María Martínez', 'Brisas de San Pablo · Torre 34', 0, 'asignada', 'organico', 'H-02', 0, 5, '12:00'),
    seed(122, 'Frutería El Paraíso', 'Corredor comercial', -1, 'recolectada', 'organico', 'H-01', 0, 8.5, '08:15'),
    seed(121, 'Ana Pineda', 'Brisas de San Pablo · Torre 35', -1, 'pendiente'),
    seed(120, 'Panadería El Trigal', 'Corredor comercial', -2, 'asignada', 'organico', 'H-01', 1, 5, '09:00'),
    seed(119, 'Sofía Amaya', 'Brisas de San Pablo · Torre 36', -2, 'pendiente'),
    seed(118, 'Comedor Los Almendros', 'Corredor comercial', -3, 'asignada', 'organico', 'H-03', 2, 5, '15:00'),
    seed(117, 'Sara Romero', 'Brisas de San Pablo · Torre 34', -3, 'pendiente'),
    seed(116, 'Lucía Pérez', 'Brisas de San Pablo · Torre 36', -4, 'recolectada', 'organico', 'H-03', -3, 2.25),
    seed(115, 'Jaime Orozco', 'Brisas de San Pablo · Torre 35', -4, 'rechazada', 'organico', 'H-02', -3),
    seed(114, 'Restaurante Buena Mesa', 'Corredor comercial', -5, 'recolectada', 'organico', 'H-01', -4, 12),
    seed(113, 'Andrés Meza', 'Brisas de San Pablo · Torre 34', -6, 'recolectada', 'organico', 'H-02', -5, 4.75),
    seed(130, 'Tienda Los Pinos', 'Corredor comercial', 0, 'pendiente', 'aprovechable'),
    seed(131, 'Comedor La Ceiba', 'Corredor comercial', -2, 'asignada', 'organico', 'H-01', 0, 5, '14:00'),
    seed(132, 'Puesto de jugos El Parque', 'Corredor comercial', -2, 'asignada', 'organico', 'H-02', 0, 5, '16:00'),
    seed(133, 'Brisas · Torre 35', 'Brisas de San Pablo', -3, 'recolectada', 'organico', 'H-03', 0, 3.5, '09:00'),
    seed(134, 'Brisas · Torre 36', 'Brisas de San Pablo', -3, 'asignada', 'organico', 'H-03', 0, 5, '13:00'),
    seed(135, 'Café La Palma', 'Corredor comercial', -2, 'recolectada', 'organico', 'H-04', 0, 7, '10:00'),
    seed(136, 'Cocina El Patio', 'Corredor comercial', -3, 'asignada', 'organico', 'H-04', 0, 5, '17:30'),
    seed(137, 'Familia Ríos', 'Brisas de San Pablo · Torre 34', -2, 'asignada', 'organico', 'H-05', 0, 5, '11:30'),
    seed(129, 'Laura Méndez', 'Brisas de San Pablo · Torre 36', -1, 'asignada', 'aprovechable', 'R-01', 0, 5, '10:30'),
    seed(128, 'Óscar Lozano', 'Brisas de San Pablo · Torre 35', -1, 'pendiente', 'aprovechable'),
    seed(127, 'Miscelánea El Puente', 'Corredor comercial', -2, 'asignada', 'aprovechable', 'R-02', 1, 5, '14:00'),
    seed(126, 'Julián Peralta', 'Brisas de San Pablo · Torre 34', -2, 'recolectada', 'aprovechable', 'R-01', -1, 6),
    seed(125, 'Lina Camacho', 'Brisas de San Pablo · Torre 36', -4, 'rechazada', 'aprovechable', 'R-01', -3),
    seed(138, 'Miscelánea San Pablo', 'Corredor comercial', -1, 'asignada', 'aprovechable', 'R-02', 0, 5, '14:30'),
  ]

  return { requests, collectors }
}
