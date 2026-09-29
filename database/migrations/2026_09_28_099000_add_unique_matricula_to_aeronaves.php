<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Índice único en la matrícula, que cierra el bloque.
 *
 * Va al final a propósito: en un servidor con matrículas repetidas esta
 * migración falla, y depurarlas requiere antes el reporte del importador.
 */
return new class extends Migration
{
    public function up(): void
    {
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
