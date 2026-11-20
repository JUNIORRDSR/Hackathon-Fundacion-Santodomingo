"""Regla de puntos (RN-06): explicable y parametrizable. Valores de ejemplo hasta que la fundación los valide."""
from dataclasses import dataclass
from decimal import Decimal

from app.compartido.formato import kilos
from app.compartido.tipos import Flujo


@dataclass(frozen=True)
class Regla:
    version: int
    base: dict[Flujo, int]  # puntos por recolección válida
    por_kg: dict[Flujo, Decimal]  # bono por kilo, cuando se pesó

    def calcular(self, flujo: Flujo, kg: Decimal | None) -> tuple[int, str]:
        """Devuelve los puntos y su explicación en texto, que se guarda con el movimiento."""
        base = self.base[flujo]
        if kg is None:
            return base, f"{base} por separar bien, sin pesar"
        bono = int(kg * self.por_kg[flujo])
        return base + bono, f"{base} por separar bien + {bono} por {kilos(kg)} kg"
