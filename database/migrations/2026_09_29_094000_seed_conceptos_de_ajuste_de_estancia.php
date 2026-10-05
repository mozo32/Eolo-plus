<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Identifica por concepto los dos servicios de ajuste de estancia, que el código tiene
 * que reconocer para cotizarlos como la DIFERENCIA entre dos tarifas de la matrícula.
 *
 * Su precio en el catálogo del origen es 0.0000, que es relleno: igual que los tres
 * tramos, el precio real sale de la tarifa y no del catálogo.
 */
return new class extends Migration
{
    // Literales y no `FactServicio::CONCEPTO_*`: una migración ya aplicada no puede
    // depender del modelo, que cambia.
    private const POR_NOMBRE = [
        'Ajuste de Estancia_de 2 hrs a 12 hrs' => 'estancia_ajuste_2h_12h',
        'Ajuste de Estancia_de 12 hrs a pernocta' => 'estancia_ajuste_12h_pernocta',
    ];

    public function up(): void
    {
        foreach (self::POR_NOMBRE as $nombre => $concepto) {
            $id = DB::table('fact_servicios')->where('nombre', $nombre)->orderBy('id')->value('id');

            if ($id !== null) {
                DB::table('fact_servicios')->where('id', $id)->update(['concepto' => $concepto]);
            }
        }
    }

    public function down(): void
    {
        DB::table('fact_servicios')
            ->whereIn('concepto', array_values(self::POR_NOMBRE))
            ->update(['concepto' => null]);
    }
};
