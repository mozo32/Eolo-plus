<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Identifica por columna propia las tres formas de pago que el código tiene que
 * reconocer, en lugar de por su nombre, que se edita en pantalla.
 *
 * Mismo patrón y mismo motivo que `fact_servicios.concepto` del bloque 2: las
 * reglas del cobro son por forma de pago (Efectivo puede exceder el total, AvCard
 * se rechaza con combustible, Amex lleva comisión) y `utf8mb4_unicode_ci` pliega
 * caja y acentos, así que una comparación por nombre siempre tiene bordes.
 *
 * Asigna el concepto por nombre a las filas que ya estén importadas. Las que no
 * coincidan las asigna el importador, que va por el id del origen; por eso la guía
 * de despliegue exige volver a correrlo.
 */
return new class extends Migration
{
    // Literales y no `FactFormaPago::CONCEPTO_*`: una migración ya aplicada no puede
    // depender del modelo, que cambia; si se renombrara una constante, dejaría de
    // cargar en una instalación nueva.
    private const POR_NOMBRE = [
        'Efectivo' => 'efectivo',
        'Amex' => 'amex',
        'AvCard by WFS' => 'avcard',
    ];

    public function up(): void
    {
        Schema::table('fact_formas_pago', function (Blueprint $table) {
            $table->string('concepto', 32)->nullable()->unique()->after('nombre');
        });

        foreach (self::POR_NOMBRE as $nombre => $concepto) {
            // Una sola fila por nombre: si la collation plegara dos filas al mismo
            // nombre, el índice único rechazaría la segunda y la migración fallaría
            // a media tabla.
            $id = DB::table('fact_formas_pago')->where('nombre', $nombre)->orderBy('id')->value('id');

            if ($id !== null) {
                DB::table('fact_formas_pago')->where('id', $id)->update(['concepto' => $concepto]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('fact_formas_pago', function (Blueprint $table) {
            $table->dropUnique(['concepto']);
            $table->dropColumn('concepto');
        });
    }
};
