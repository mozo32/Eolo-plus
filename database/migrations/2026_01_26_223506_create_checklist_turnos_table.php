<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('checklist_turnos', function (Blueprint $table) {
            $table->id();

            // Datos generales
            $table->string('nombre_empleado');
            $table->date('fecha');

            // Recibe turno
            $table->json('recibe_turno_con');
            $table->text('observaciones_recibe')->nullable();

            // Revisión salas
            $table->json('revision_salas');

            // Hot / Traslado / Comida / Coordinación
            $table->json('hot_tras_comi_coor')->nullable();

            // Checks finales
            $table->boolean('revision_base_operaciones')->default(false);
            $table->boolean('envia_informe_diario')->default(false);
            $table->boolean('envia_resumen_semanal')->default(false);

            // Entrega turno
            $table->json('entrega_turno_con');
            $table->text('observaciones_entrega')->nullable();

            // Totales
            $table->integer('cantidad_pasajeros');
            $table->integer('cantidad_operaciones');

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('checklist_turnos');
    }
};
