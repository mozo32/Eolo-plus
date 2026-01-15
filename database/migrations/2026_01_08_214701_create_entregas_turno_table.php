<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('entregas_turno', function (Blueprint $table) {
            $table->id();
            $table->date('fecha');
            $table->string('nombre');
            $table->string('nombre_quien_entrega');
            $table->string('nombre_jefe_turno_despacho');
            $table->json('checklist_comunicacion')->nullable();
            $table->json('equipo_oficina')->nullable();
            $table->json('copiadoras')->nullable();
            $table->json('fondo_documentacion')->nullable();
            $table->text('estado_caja_fuerte')->nullable();
            $table->char('status', 1)->default('A');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('entregas_turno');
    }
};
