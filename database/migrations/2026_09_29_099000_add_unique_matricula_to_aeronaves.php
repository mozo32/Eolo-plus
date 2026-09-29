<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Índice único en la matrícula, que cierra el bloque.
 *
 * Va al final a propósito (debe seguir siendo la última migración): en un
 * servidor con matrículas repetidas falla, pero con un mensaje que las lista en
 * lugar del error crudo del motor. Como las migraciones anteriores ya
 * quedaron aplicadas, se depuran las repetidas y se vuelve a correr
 * `php artisan migrate`.
 */
return new class extends Migration
{
    public function up(): void
    {
        $repetidas = DB::table('aeronaves')
            ->select('matricula', DB::raw('COUNT(*) as veces'))
            ->groupBy('matricula')
            ->havingRaw('COUNT(*) > 1')
            ->orderBy('matricula')
            ->get();

        if ($repetidas->isNotEmpty()) {
            $lista = $repetidas
                ->take(50)
                ->map(fn ($fila) => "{$fila->matricula} ({$fila->veces} filas)")
                ->implode(', ');
            $resto = $repetidas->count() > 50 ? ' y '.($repetidas->count() - 50).' más' : '';

            throw new RuntimeException(
                "No se puede crear el índice único en aeronaves.matricula: hay {$repetidas->count()} "
                ."matrícula(s) repetida(s): {$lista}{$resto}. "
                .'Depúralas (conserva una fila por matrícula y reasigna sus referencias) y vuelve a correr php artisan migrate.'
            );
        }

        Schema::table('aeronaves', function (Blueprint $table) {
            $table->unique('matricula');
        });
    }

    public function down(): void
    {
        Schema::table('aeronaves', function (Blueprint $table) {
            $table->dropUnique(['matricula']);
        });
    }
};
