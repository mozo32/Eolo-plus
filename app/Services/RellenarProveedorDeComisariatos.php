<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Rellena `servicio_comisariatos.fact_servicio_id` en las filas anteriores a la lista de proveedores.
 *
 * Solo rellena lo que no admite duda: el texto libre de `catering` contiene el nombre del
 * proveedor. Empareja por texto, sin distinguir mayúsculas. Lo que no empareja se queda en nulo:
 * adivinar ahí sería inventar. No pisa un proveedor ya elegido. Si el servicio no existe en esta
 * base —una instalación nueva, o las pruebas— no hay nada que rellenar y no se rompe.
 *
 * Usa el query builder y no los modelos a propósito: la invoca una migración, que tiene que seguir
 * funcionando aunque los modelos cambien.
 */
final class RellenarProveedorDeComisariatos
{
    /** Fragmento (en minúsculas) del texto libre => nombre exacto del servicio del catálogo. */
    private const EQUIVALENCIAS = [
        'comexa' => 'Comisariato_Comexa',
        'manny' => 'Comisariato_Manny',
    ];

    public function __invoke(): void
    {
        foreach (self::EQUIVALENCIAS as $fragmento => $nombreDelServicio) {
            $servicioId = DB::table('fact_servicios')->where('nombre', $nombreDelServicio)->value('id');

            if ($servicioId === null) {
                // Nada que rellenar no es lo mismo que "el catálogo no está": lo segundo se dice.
                Log::warning(
                    "RellenarProveedorDeComisariatos: no existe el servicio '{$nombreDelServicio}' en fact_servicios; "
                    . 'por eso no rellenó el proveedor de los comisariatos cuyo texto nombra a ese proveedor.'
                );

                continue;
            }

            DB::table('servicio_comisariatos')
                ->whereNull('fact_servicio_id')
                ->whereRaw('LOWER(catering) LIKE ?', ["%{$fragmento}%"])
                ->update(['fact_servicio_id' => $servicioId]);
        }
    }
}
