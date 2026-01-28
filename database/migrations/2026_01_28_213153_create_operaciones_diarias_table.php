<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('operaciones_diarias', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->date('fecha');
            $table->enum('tipo', ['llegada', 'salida']);
            $table->string('matricula', 20);
            $table->string('equipo', 50);
            $table->time('hora');
            $table->string('lugar', 100);
            $table->unsignedSmallInteger('pax');
            $table->timestamps();
            $table->index(['fecha', 'tipo']);
            $table->index('matricula');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('operaciones_diarias');
    }
};
