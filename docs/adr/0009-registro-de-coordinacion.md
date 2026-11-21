# ADR-0009 · La coordinación crea su cuenta con el código de la fundación

- **Estado:** aceptada · 2026-11-20

## Contexto

Hay dos colectivos, huerteros y recicladores, y cada uno tiene su coordinación. Hasta hoy solo el administrador creaba
usuarios, así que un coordinador nuevo dependía de él para entrar. Una cuenta de coordinación ve nombres, direcciones y
teléfonos de vecinos (Ley 1581): no puede abrirse a cualquiera que llegue a la página.

## Decisión

- La entrada tiene dos pestañas: **Entrar** y **Crear cuenta**. Al crear la cuenta se elige el colectivo (Huerteros o
  Recicladores), el nombre, el usuario y la clave, y se escribe el **código de la fundación**.
- El código vive en la variable de entorno `CODIGO_REGISTRO` (en local, `villas-2026`); en producción es obligatorio y
  va como secreto. Se compara en tiempo constante. Sin el código correcto la API responde 403.
- La cuenta nace como coordinador de ese colectivo y entra de una vez. Solo ve su colectivo, como siempre (§9).
- Cambiar de equipo desde el perfil: el administrador cambia en el acto; un coordinador sale y la entrada queda con el
  usuario del otro colectivo escrito, para que solo ponga la clave.

## Alternativas descartadas

- Registro libre: expone datos personales a cualquiera.
- Solicitud de cuenta aprobada por el administrador: más segura, pero necesita otra pantalla y un estado más; queda
  como mejora si el código se filtra.
