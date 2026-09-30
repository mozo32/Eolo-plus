<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cómo se agrupan los servicios en la pantalla de captura: Tránsitos,
 * Comisariatos, Servicios en Plataforma. Son 13 en los datos reales, y una de
 * ellas (`Dugaeam Fee`) no tiene ningún servicio.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_categorias_servicio', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 80)->unique();
            $table->char('status', 1)->default('A')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_categorias_servicio');
    }
};
