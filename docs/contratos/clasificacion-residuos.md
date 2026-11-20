# Contrato: clasificación de residuos por foto

> **Estado:** aprobado el 20 de noviembre de 2026. **Lo usan:** la línea base (bot de WhatsApp, base de datos y panel) y el módulo de capacitación. **Código:** [`src/lib/clasificacion.ts`](../../src/lib/clasificacion.ts). Hasta que llegue la implementación real (PR 2), la función responde siempre `no_concluyente`, así que el bot ya puede conectarla.

## Qué hace

Cuando un usuario manda por WhatsApp la foto de los residuos que quiere entregar, el bot le dice, antes de la recolección, si están bien separados. Si no lo están, le envía recursos de capacitación.

Es **orientativo**: nunca bloquea la solicitud, no cambia su estado y no suma ni resta puntos (RN-05). Quien valida es el reciclador o el huertero al recoger (RF-10). También es **opcional**: la foto no está entre los datos mínimos de la solicitud (§5.3 del reto), así que la ruta crítica no depende de este módulo.

## Decisiones

| Tema | Decisión | Por qué |
|---|---|---|
| Cómo clasifica | Un modelo con visión de Azure OpenAI, con las reglas de separación en el prompt y respuesta en JSON con esquema estricto | El §8.1 solo permite OpenAI, Azure OpenAI, Azure AI Foundry y Claude. Entrenar un modelo propio no cabe en la hackathon, y un etiquetador genérico ("botella", "comida") no juzga la separación |
| Dónde corre | Una función dentro de la app TypeScript, no un servicio aparte | No agrega infraestructura. El cómputo ocurre en Azure, no en el servidor ni en las tablets |
| Quién le escribe al usuario | Solo el bot | El chat y las credenciales de Meta tienen un único dueño |
| Costo | Créditos de Azure for Students durante la hackathon | El mismo código funciona con la API de OpenAI cambiando las variables de entorno |

## Flujo

```
Usuario ─foto─► Meta Cloud API ─webhook─► App (línea base)
                                          1. responde 200 a Meta de inmediato
                                          2. descarga la imagen (media_id → url → bytes)
                                          3. evaluarSeparacion(bytes, mime, flujo) ──► Azure OpenAI
                                          4. si está mal separada: recursos de capacitación
                                          5. le responde al usuario
                                          6. guarda la evaluación en la solicitud ──► panel (tablet)
```

## C1. Interfaz

Todo se importa desde `@/lib/clasificacion`:

```ts
type Flujo = "organico" | "aprovechable";
type Veredicto = "bien_separado" | "mal_separado" | "no_concluyente";
type Problema =
  | "organico_en_aprovechables"
  | "aprovechable_en_organicos"
  | "no_aprovechable_mezclado" // papel higiénico, servilletas usadas, pañales
  | "envases_sucios"           // con restos de comida o líquido
  | "residuo_peligroso"        // vidrio roto, pilas, medicamentos, jeringas
  | "foto_no_valida";          // borrosa, oscura, bolsa cerrada o no son residuos

interface EvaluacionSeparacion {
  veredicto: Veredicto;
  flujoDetectado: Flujo | null; // null = mezclado o no se distingue
  problemas: Problema[];        // [] si está bien separado
  mensajeUsuario: string;       // máximo 300 caracteres, español sencillo, listo para enviar
  modelo: string;               // qué modelo evaluó (§9 del reto)
  error: string | null;         // solo si no se pudo evaluar
}

function clasificacionActiva(): boolean; // lee CLASIFICACION_ACTIVA

function evaluarSeparacion(
  imagen: Uint8Array,   // la imagen descargada de WhatsApp
  mimeType: string,     // "image/jpeg" o "image/png"; otro formato da "no_concluyente"
  flujo: Flujo | null,  // lo que el usuario dijo que va a entregar; null si aún no lo dijo
): Promise<EvaluacionSeparacion>; // nunca falla: ante cualquier error devuelve "no_concluyente"
```

`no_concluyente` cubre fotos borrosas, bolsas cerradas, imágenes que no son residuos y errores técnicos. En este último caso, `error` dice cuál fue.

## C2. Lo que hace el bot

- Si `clasificacionActiva()` es `false`, se salta la evaluación. La foto se guarda igual (RF-03).
- Procesa la imagen **después** de responderle 200 a Meta (en Next.js, con `after()`). La evaluación tarda unos segundos y el módulo corta a los 20 s.
- Solo procesa mensajes de tipo `image`. El bot descarga la imagen; al módulo no le llegan tokens de Meta ni el teléfono, el nombre o la dirección del usuario.
- Responde según el veredicto:

| Veredicto | Respuesta del bot |
|---|---|
| `bien_separado` | Confirma y sigue con la solicitud |
| `mal_separado` | Envía `mensajeUsuario`, hasta dos recursos de capacitación y los botones «Enviar otra foto» y «Solicitar así» |
| `no_concluyente` | Pide otra foto una sola vez o sigue sin evaluación |

Ejemplo:

```ts
import { after } from "next/server";
import { clasificacionActiva, evaluarSeparacion } from "@/lib/clasificacion";

// En el route handler del webhook, para un mensaje de tipo "image":
if (clasificacionActiva()) {
  after(async () => {
    const bytes = await descargarImagen(mensaje.image.id); // la implementa el bot
    const evaluacion = await evaluarSeparacion(bytes, mensaje.image.mime_type, flujo);
    // 1) guardarla en la solicitud (C4)  2) responder según evaluacion.veredicto
  });
}
return new Response("OK", { status: 200 });
```

## C3. Módulo de capacitación

Los dos módulos se conectan por los códigos de `Problema`. Son texto, así que el módulo de capacitación no necesita importar este código; si quiere recorrerlos, están en la constante `PROBLEMAS`. Debe ofrecer algo como `recursosPara(problemas)`, con al menos un recurso por código y uno genérico. El bot coordina los dos: este módulo no llama al de capacitación.

## C4. Base de datos

```sql
ALTER TABLE solicitudes ADD COLUMN evaluacion_foto JSONB NULL;
```

Guarda el `EvaluacionSeparacion` completo. El panel muestra un aviso cuando `evaluacion_foto->>'veredicto' = 'mal_separado'`. La foto la guarda la línea base (RF-03); este módulo no escribe en la base de datos.

## C5. Variables de entorno

Solo en el servidor, nunca con el prefijo `NEXT_PUBLIC_`:

| Variable | Valor |
|---|---|
| `OPENAI_BASE_URL` | `https://<recurso>.openai.azure.com/openai/v1/` |
| `OPENAI_API_KEY` | La clave del recurso de Azure |
| `CLASIFICACION_MODELO` | El nombre del despliegue en Azure |
| `CLASIFICACION_ACTIVA` | `true` para activar el módulo |

Para usar la API de OpenAI en lugar de Azure, se borra `OPENAI_BASE_URL` y se ponen la clave y el modelo de OpenAI. El código no cambia.

### Configurar Azure (una vez)

1. Activa Azure for Students con el correo institucional.
2. En Microsoft Foundry ([ai.azure.com](https://ai.azure.com)), crea un recurso. Si no te deja, prueba las regiones East US 2 o Sweden Central, que son las que reportan otros estudiantes.
3. Despliega un modelo con visión que siga vigente, por ejemplo `gpt-5-mini`. No sirven `gpt-4o-mini` ni `gpt-4.1-mini`: ya se retiraron.
4. Copia el endpoint, la clave y el nombre del despliegue en las variables de arriba.

Si aparece cuota 0 o el error `RequestDisallowedByAzure`, hay tres salidas: pedir aumento de cuota en el portal, usar la cuenta gratuita de Azure (US$200 por 30 días; pide tarjeta) o usar la API de OpenAI con una recarga pequeña.

## Controles (§9 del reto)

- Es orientativo: la decisión final es de una persona.
- Si el modelo duda, responde `no_concluyente`.
- La respuesta solo puede tomar los valores del esquema.
- Cada evaluación queda guardada y se compara con lo que registró el reciclador. De ahí sale una tasa de acierto que sirve como indicador (RF-20).
- Al modelo solo se le envían la imagen y el flujo.

## Pendiente

- **Reglas de la huerta:** la documentación no dice qué orgánicos acepta (¿carne, huesos, lácteos?). Las reglas quedan en un texto editable, marcadas «por validar con la huerta», a partir del código de colores nacional (blanco, verde y negro).
- **Modelo:** se elige con 10 a 15 fotos reales de prueba (bolsa bien separada, mezclada, con envases sucios y cerrada).
