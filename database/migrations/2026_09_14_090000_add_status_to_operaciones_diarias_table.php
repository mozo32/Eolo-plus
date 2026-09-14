<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Estado de la operación diaria: true activa, false cancelada.
 *
 * El valor predeterminado deja activos todos los registros históricos. Una
 * operación cancelada se conserva en el historial, pero deja de contar como
 * movimiento operativo (secuencia, pernocta, conteos, pendientes).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('operaciones_diarias', function (Blueprint $table) {
            $table->boolean('status')->default(true)->index()->after('validaciones');
        });
    }

    public function down(): void
    {
        Schema::table('operaciones_diarias', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropColumn('status');
        });
    }
};
