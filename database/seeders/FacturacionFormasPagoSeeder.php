<?php

namespace Database\Seeders;

use App\Models\FactFormaPago;
use Illuminate\Database\Seeder;

/**
 * Forma de pago que el sistema necesita y el origen NO trae: el saldo a favor, que allí
 * se capturaba como un renglón con precio negativo y bajaba el IVA de la cuenta.
 *
 * Es un seeder y no una migración a propósito: `fact_formas_pago` es un espejo del
 * catálogo del origen y una migración sembraría la fila en toda base, también en las que
 * aún no importan. Por la misma razón NO va en `DatabaseSeeder`: se corre a mano y
 * DESPUÉS del importador, porque la guarda de `facturacion:importar-matriculas --aplicar`
 * se niega sin `--forzar` si la tabla ya tiene filas. El importador solo agrega
 * (`firstOrCreate`), así que la fila sembrada sobrevive a las reimportaciones.
 *
 * Idempotente y sin pisar ediciones: si el concepto ya existe no toca nombre ni estado,
 * que se editan en pantalla. `nombre` es único, así que si alguien creó a mano una forma
 * llamada igual y sin concepto, se le asigna el concepto en lugar de chocar con el índice.
 */
class FacturacionFormasPagoSeeder extends Seeder
{
    public function run(): void
    {
        if (FactFormaPago::porConcepto(FactFormaPago::CONCEPTO_SALDO_A_FAVOR)->exists()) {
            return;
        }

        $preexistente = FactFormaPago::where('nombre', 'Saldo a favor')->whereNull('concepto')->orderBy('id')->first();

        if ($preexistente !== null) {
            $preexistente->update(['concepto' => FactFormaPago::CONCEPTO_SALDO_A_FAVOR]);

            return;
        }

        FactFormaPago::create([
            'nombre' => 'Saldo a favor',
            'concepto' => FactFormaPago::CONCEPTO_SALDO_A_FAVOR,
            'status' => FactFormaPago::STATUS_ACTIVO,
        ]);
    }
}
