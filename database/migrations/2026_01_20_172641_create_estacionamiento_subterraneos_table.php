<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('estacionamiento_subterraneos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->string('vehiculo', 100);
            $table->string('color', 50)->nullable();
            $table->string('placas', 20);
            $table->string('matricula', 50)->nullable();
            $table->string('responsable', 150);
            $table->dateTime('fecha_ingreso');
            $table->dateTime('fecha_salida')->nullable();
            $table->string('oficial', 150);
            $table->timestamps();
            $table->index('placas');
            $table->index('fecha_ingreso');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('estacionamiento_subterraneos');
    }
};
