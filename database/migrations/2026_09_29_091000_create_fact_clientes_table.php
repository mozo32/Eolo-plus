<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Clientes a los que se factura.
 *
 * El RFC lleva índice pero NO es único: se repite de forma legítima. En los
 * datos reales, `XAXX010101000` (público en general) lo comparten 22 clientes
 * distintos y `XEXX010101000` (residentes en el extranjero) otros 5. El nombre
 * tampoco es único, aunque hoy no haya ninguno repetido.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_clientes', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 160)->index();
            $table->string('rfc', 20)->nullable()->index();
            $table->string('correo', 120)->nullable();
            $table->string('telefono', 20)->nullable();
            $table->char('status', 1)->default('A')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_clientes');
    }
};
