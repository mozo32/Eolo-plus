<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Altas y reabastecimientos de medicamentos. Antes solo se modificaba el stock
 * y no quedaba rastro; ahora cada uno deja una fila para Últimos Movimientos.
 * Las entregas siguen en entrega_medicamentos y los cierres en
 * control_medicamentos: esta tabla solo cubre lo que no tenía dónde vivir.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('movimientos_medicamentos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('medicamento_id')->constrained('medicamentos')->cascadeOnDelete();
            // NUEVO | REABASTECIMIENTO
            $table->string('tipo', 20)->index();
            $table->unsignedInteger('cantidad');
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('movimientos_medicamentos');
    }
};
