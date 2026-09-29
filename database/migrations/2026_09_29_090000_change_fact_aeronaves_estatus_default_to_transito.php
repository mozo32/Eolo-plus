<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * El sistema viejo da de alta toda matrícula nueva con `id_estatus = 1`, que en
 * `tb_estatus` es "Transito" (el 2 es "Guarda"). Además, `insert22.php` cobra la
 * estancia cuando `$estatus == 1`: paga el tránsito, y la guarda no, porque tiene
 * contrato de hangar.
 *
 * La migración original dejó el default en 'guarda', con lo que una matrícula
 * nueva nacía pagando estancia cuando el sistema viejo no se la cobraba.
 *
 * Solo cambia el default: las filas existentes conservan su estatus.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fact_aeronaves', function (Blueprint $table) {
            $table->string('estatus', 10)->default('transito')->change();
        });
    }

    public function down(): void
    {
        Schema::table('fact_aeronaves', function (Blueprint $table) {
            $table->string('estatus', 10)->default('guarda')->change();
        });
    }
};
