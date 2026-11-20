# ADR-0004 · Acceso por perfiles y privacidad

- **Estado:** aceptada · 2026-11-20

## Contexto

El §5.1 pide distinguir perfiles y pedir solo los datos necesarios. RN-07 limita contacto y ubicación a quien atiende.
Los organizadores aclararon que solo los coordinadores usan tecnología (20/11). Aplica la Ley 1581 de 2012.

## Decisión

- Con cuenta: coordinador de huerteros, coordinador de recicladores y administrador. Sin cuenta: el solicitante (por
  WhatsApp) y el encargado (registro sin acceso).
- Login con usuario y clave. La clave se guarda con scrypt (`hashlib`, librería estándar) y la sesión es una cookie
  firmada de 30 días para la tablet, solo por HTTPS en producción.
- Cada router filtra por rol y colectivo: un coordinador solo ve la bandeja de su colectivo y el administrador ve todo
  (RN-01, RN-07).
- Datos del solicitante: teléfono, nombre o alias, tipo, zona, dirección y fecha de la autorización. Nada más.
- Reportes y CSV sin nombre, teléfono ni dirección. Las semillas y la demo usan datos ficticios.

## Consecuencias

- Los datos del usuario viajan en la cookie firmada: un cambio de rol se ve cuando la persona vuelve a entrar.
