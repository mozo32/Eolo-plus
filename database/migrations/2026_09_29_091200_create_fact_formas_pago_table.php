<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Catálogo de formas de pago. Define las opciones de pago disponibles en el
 * sistema de facturación: efectivo, transferencia, tarjetas de crédito, etc.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_formas_pago', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 60)->unique();
            $table->char('status', 1)->default('A')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_formas_pago');
    }
};
