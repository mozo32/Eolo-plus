<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('entregas_turno_seguridad', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained();
            $table->dateTime('fecha_hora');
            $table->string('seccion', 10);

            $table->boolean('aviones_csae')->default(false);
            $table->boolean('combustible')->default(false);
            $table->boolean('resguardo_vehicular')->default(false);
            $table->boolean('estacionamiento')->default(false);
            $table->boolean('posiciones')->default(false);
            $table->boolean('vehiculos')->default(false);
            $table->boolean('operaciones')->default(false);
            $table->boolean('visitantes')->default(false);

            $table->char('pernocta_mensual', 1)->default('R');
            $table->text('observaciones')->nullable();
            $table->char('status', 1)->default('A');
            $table->timestamps();

            /*
             * El nombre va a mano y corto. El que Laravel generaría
             * (`entregas_turno_seguridad_fecha_hora_seccion_index`, 49)
             * cabría, pero dejarlo al generador es cómo se llegó una vez a
             * un índice de 69 caracteres que MySQL rechazó en producción
             * después de pasar toda la suite en sqlite.
             */
            $table->index(['fecha_hora', 'seccion'], 'entregas_turno_seg_fecha_seccion_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('entregas_turno_seguridad');
    }
};
