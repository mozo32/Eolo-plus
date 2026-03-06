<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('inspecciones_autotanque', function (Blueprint $table) {
            $table->id();
            $table->dateTime('fecha_inspeccion');
            $table->string('operador');
            $table->bigInteger('kilometraje');
            $table->integer('porcentaje_combustible');
            $table->json('checklist_respuestas');
            $table->json('danos_grafico')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('inspecciones_autotanque');
    }
};
