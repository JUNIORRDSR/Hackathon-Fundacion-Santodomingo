"""La identidad de quien escribe según Twilio (ADR-0016). Solo se enlaza por el BSUID que llega firmado junto al
teléfono, nunca por el nombre de perfil, que cualquiera puede cambiar."""
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert

from app.compartido.bd import transaccion
from app.modulos.whatsapp import tablas as t
from app.modulos.whatsapp.contrato import Perfil


def recordar(telefono: str, perfil: Perfil) -> None:
    """Guarda lo último que Twilio dijo del contacto. Si el BSUID estaba en otro teléfono, pasa a este."""
    valores = {"telefono": telefono, "visto_en": datetime.now(timezone.utc),
               **perfil.model_dump(exclude_none=True, exclude={"nombre"})}
    if perfil.nombre:
        valores["perfil"] = perfil.nombre
    columnas = t.contactos.c
    with transaccion() as c:
        if perfil.bsuid:
            anterior = (columnas.bsuid == perfil.bsuid) & (columnas.telefono != telefono)
            c.execute(update(t.contactos).where(anterior).values(bsuid=None))
        c.execute(insert(t.contactos).values(valores)
                  .on_conflict_do_update(index_elements=[columnas.telefono], set_=valores))


def telefono_de(bsuid: str) -> str | None:
    with transaccion() as c:
        return c.execute(select(t.contactos.c.telefono).where(t.contactos.c.bsuid == bsuid)).scalar_one_or_none()


def perfil_de(telefono: str) -> Perfil | None:
    columnas = t.contactos.c
    consulta = select(columnas.perfil, columnas.usuario, columnas.bsuid).where(columnas.telefono == telefono)
    with transaccion() as c:
        fila = c.execute(consulta).first()
    return Perfil(nombre=fila.perfil, usuario=fila.usuario, bsuid=fila.bsuid) if fila else None
