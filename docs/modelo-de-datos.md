# Modelo de datos

PostgreSQL con un esquema por módulo (ADR-0001). Dentro de un módulo hay claves foráneas; entre módulos, las referencias
van por ID y sin clave foránea (líneas punteadas), para que cada módulo pueda cambiar sus tablas sin romper a otro. Las
tablas salen de `backend/app/modulos/<módulo>/tablas.py`.

```mermaid
erDiagram
  directorio_zonas ||--o{ directorio_conjuntos : "zona_id"
  directorio_zonas ||--o{ directorio_solicitantes : "zona_id"
  directorio_conjuntos |o--o{ directorio_solicitantes : "conjunto_id"
  directorio_solicitantes ||..o{ solicitudes_solicitudes : "solicitante_id (por ID)"
  directorio_zonas ||..o{ solicitudes_solicitudes : "zona_id (por ID)"
  directorio_conjuntos |o..o{ solicitudes_solicitudes : "conjunto_id (por ID)"
  directorio_encargados |o..o{ solicitudes_solicitudes : "encargado_id (por ID)"
  acceso_usuarios |o..o{ solicitudes_solicitudes : "asignada_por (por ID)"
  directorio_solicitantes ||..o{ puntos_movimientos : "solicitante_id (por ID)"
  solicitudes_solicitudes ||..o| puntos_movimientos : "codigo (por ID)"
  puntos_reglas ||--o{ puntos_movimientos : "regla_version"
  directorio_solicitantes ||..o| whatsapp_conversaciones : "telefono (por ID)"
  directorio_solicitantes ||..o{ whatsapp_mensajes : "telefono (por ID)"

  acceso_usuarios {
    uuid id PK
    string usuario UK
    string nombre
    string rol "coordinador | administrador"
    string colectivo "solo coordinadores"
    string clave "sal y hash scrypt"
  }
  directorio_zonas {
    uuid id PK
    string nombre UK "Etapa 1 a 4, Corredor comercial"
    boolean activo "nada se borra: se desactiva"
  }
  directorio_conjuntos {
    uuid id PK
    uuid zona_id FK
    string nombre "único dentro de su zona"
    boolean activo
  }
  directorio_solicitantes {
    uuid id PK
    string telefono UK "E.164"
    string nombre "nombre o alias"
    string tipo "hogar | unidad_productiva"
    uuid zona_id FK
    uuid conjunto_id FK "vacío si la zona no tiene conjuntos"
    string direccion "torre, apto, casa o local"
    string estado "pendiente | habilitado"
    timestamptz autorizo_en "Ley 1581"
    string registrado_por "quien firmó en la tableta; vacío si fue por WhatsApp"
  }
  directorio_encargados {
    uuid id PK
    string nombre
    string colectivo "huerteros | recicladores"
    jsonb lugares "conjuntos (o zonas sin conjuntos) que cubre"
    boolean activo
  }
  solicitudes_solicitudes {
    uuid id PK
    string codigo UK "ORG-0001 | REC-0001"
    uuid solicitante_id
    string flujo "organico | reciclable"
    uuid zona_id
    uuid conjunto_id "copia al recibir"
    string direccion "copia al recibir"
    string preferencia "manana | tarde | noche"
    string canal "whatsapp | asistido | simulador | huerta"
    string estado
    uuid encargado_id
    uuid asignada_por
    date dia
    time hora
    numeric kg
    string motivo
    jsonb historial "RN-04"
    timestamptz recibida
  }
  puntos_reglas {
    int version PK
    jsonb base
    jsonb por_kg
    timestamptz creada
  }
  puntos_movimientos {
    uuid id PK
    uuid solicitante_id
    int puntos
    string codigo UK "una recolección acredita una vez"
    int regla_version FK
    string explicacion
    timestamptz fecha
  }
  contenidos_contenidos {
    uuid id PK
    string titulo
    string proposito "educacion | tutorial"
    string audiencia "solicitante | coordinador | encargado"
    string flujo "vacío: general"
    string formato "video | imagen | texto"
    string texto_corto
    string url
    boolean activo
  }
  whatsapp_conversaciones {
    string telefono PK
    jsonb memoria "paso del registro o del bot"
    timestamptz actualizada
  }
  whatsapp_mensajes {
    int id PK
    string telefono
    string texto
    string estado "enviado | fallido"
    timestamptz enviado_en
  }
```

## Reglas que viven en la base

- **Una sola solicitud abierta por solicitante y flujo:** índice único parcial `una_abierta_por_flujo` sobre
  `(solicitante_id, flujo)` cuando el estado es recibida, asignada o programada.
- **Códigos cortos:** las secuencias `solicitudes.consecutivo_organico` y `solicitudes.consecutivo_reciclable`.
- **El libro de puntos solo crece:** nada actualiza ni borra `puntos.movimientos`, y `codigo` es único, así que una
  recolección no puede acreditar dos veces.
