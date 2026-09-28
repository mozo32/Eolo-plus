<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Precio del combustible con historial.
 *
 * En el sistema viejo `tb_combustible` es una sola fila que se sobrescribe
 * (`WHERE id_combustible = 1`), así que no hay historial: la importación trae
 * esa fila como el registro vigente. Se guardan los dos precios porque hay
 * controladores que usan cada uno: Remisiones cobra con el de Eolo y Turno de
 * autotanque calcula con el de ASA.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_precios_combustible', function (Blueprint $table) {
            $table->id();
            $table->decimal('precio_asa', 10, 4);
            $table->decimal('precio_eolo', 10, 4);
            $table->date('vigencia_inicio')->index();
            $table->date('vigencia_fin')->nullable();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_precios_combustible');
    }
};
