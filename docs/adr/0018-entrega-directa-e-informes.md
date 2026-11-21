# ADR-0018 · Entrega directa en la huerta e informes por grupo

- **Estado:** aceptada · 2026-11-21 (lugar del botón aprobado por Jairo; el ADR se escribió después de construirla)

## Contexto

El reto pide registrar los pesajes que entran a la huerta, incluidas las entregas directas de quien vive cerca y lleva
sus orgánicos (RF-11, RF-05), e informes de cuánto se recolectó por usuario, zona o torre, recolector y periodo (RF-18).
El pesaje de lo recolectado ya existía («Validar kilos»); faltaban la entrega directa y el desglose.

## Decisión

1. **La entrega directa es una solicitud que nace cerrada**, con canal `huerta`: recibida, asignada a quien la recibió y
   recolectada con sus kilos, en una sola transacción. Solo publica `RecoleccionRegistrada`: el vecino gana sus puntos
   con la regla vigente y recibe ese aviso, sin los de «recibida» ni «programada». No exige que el vecino esté sin otra
   solicitud abierta, porque lo que trae ya está en la huerta.
2. **Se registra en Recolecciones**, junto a la agenda donde ya se validan kilos: «Registrar entrega en la huerta» (o en
   el punto de acopio, para recicladores). Se busca al vecino por nombre o teléfono, se escriben los kilos y quién la
   recibió. El host avisa al módulo con el evento `solicitudes-cambiaron` y la lista se actualiza sin recargar.
3. **Los informes son una página propia** («Informes», en Más): mes, desglose por conjunto, zona, encargado o vecino,
   con total y exportación a CSV. El periodo se cuenta por la fecha en que entró la solicitud, igual que el resumen.

## Consecuencias

- Historial, impacto del Inicio, informes y CSV cuentan las entregas directas sin código nuevo.
- El desglose por vecino muestra nombres a la coordinación que ya los atiende (RN-07); el CSV del mes sigue sin datos
  personales. La tabla exportada desde Informes sí lleva el nombre del grupo, y en «por vecino» ese grupo es la persona.

## Alternativas descartadas

- Un registro de pesajes aparte de las solicitudes: duplica puntos, historial e informes.
- Registrar la entrega desde el registro del vecino en Registros: queda lejos de donde se pesa.
- Agregar el desglose al Inicio: lo vuelve pesado; el Inicio queda para el impacto y el trabajo del día.
