<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Préstamos de la única planta de energía (GPU N.115). El préstamo y su
 * entrega son el mismo registro: al prestar se guarda el horómetro inicial y
 * al entregar se completan horómetro final, tiempo y status.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('relaciones_planta', function (Blueprint $table) {
            $table->id();
            $table->date('fecha');
            $table->string('empresa', 120);
            $table->string('matricula', 20)->index();
            // Horas decimales del horómetro; nunca float.
            $table->decimal('horometro_inicio', 10, 2);
            $table->decimal('horometro_fin', 10, 2)->nullable();
            // Horas decimales de uso (fin - inicio, o el valor editado).
            $table->decimal('tiempo', 8, 2)->nullable();
            $table->string('status', 12)->default('en_uso')->index();
            $table->timestamps();

            $table->index(['fecha', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('relaciones_planta');
    }
};
