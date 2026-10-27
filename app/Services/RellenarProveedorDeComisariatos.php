<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Rellena `servicio_comisariatos.fact_servicio_id` en las filas anteriores a la lista de proveedores.
 *
 * Solo rellena lo que no admite duda: el texto libre de `catering` contiene el nombre del
 * proveedor. Empareja por texto, sin distinguir mayúsculas. Lo que no empareja, o empareja con más
 * de un proveedor, se queda en nulo: adivinar ahí sería inventar. No pisa un proveedor ya elegido.
 * Si el servicio no existe en esta base —una instalación nueva, o las pruebas— no se rompe, pero
 * lo deja escrito en el log.
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
        // Para cada fila sin proveedor, los fragmentos que su texto contiene.
        $fragmentosPorFila = [];

        foreach (array_keys(self::EQUIVALENCIAS) as $fragmento) {
            $ids = DB::table('servicio_comisariatos')
                ->whereNull('fact_servicio_id')
                ->whereRaw('LOWER(catering) LIKE ?', ["%{$fragmento}%"])
                ->pluck('id');

            foreach ($ids as $id) {
                $fragmentosPorFila[$id][] = $fragmento;
            }
        }

        $serviciosPorFragmento = [];

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

            $serviciosPorFragmento[$fragmento] = $servicioId;
        }

        $idsPorServicio = [];
        $ambiguas = [];

        foreach ($fragmentosPorFila as $id => $fragmentos) {
            // Un texto que nombra a más de un proveedor no dice cuál es el bueno, y elegir mal
            // cobra con el margen equivocado sin que se note: se queda en nulo, que sí se ve.
            if (count($fragmentos) > 1) {
                $ambiguas[] = $id;

                continue;
            }

            if (isset($serviciosPorFragmento[$fragmentos[0]])) {
                $idsPorServicio[$serviciosPorFragmento[$fragmentos[0]]][] = $id;
            }
        }

        foreach ($idsPorServicio as $servicioId => $ids) {
            DB::table('servicio_comisariatos')
                ->whereNull('fact_servicio_id')
                ->whereIn('id', $ids)
                ->update(['fact_servicio_id' => $servicioId]);
        }

        if ($ambiguas !== []) {
            Log::warning(
                'RellenarProveedorDeComisariatos: el texto de catering nombra a más de un proveedor; '
                . 'se dejaron sin proveedor los comisariatos con id ' . implode(', ', $ambiguas) . '.'
            );
        }
    }
}
