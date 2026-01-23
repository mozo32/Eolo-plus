<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('entrega_turno_r', function (Blueprint $table) {
            $table->id();
            $table->json('encabezado');
            $table->json('comunicaciones');
            $table->json('vehiculos');
            $table->json('barras_remolque');
            $table->json('gpus');
            $table->json('carrito_golf');
            $table->json('aeronaves');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('entrega_turno_r');
    }
};
