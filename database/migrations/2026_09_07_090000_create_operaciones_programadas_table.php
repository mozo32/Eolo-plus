<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('operaciones_programadas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->date('fecha');
            $table->enum('tipo', ['llegada', 'salida']);
            $table->string('matricula', 20);
            $table->string('equipo', 50);
            $table->time('hora');
            $table->string('lugar', 100)->nullable();
            $table->unsignedSmallInteger('pax')->nullable();
            $table->boolean('fp')->default(false);
            $table->string('fp_folio', 50)->nullable();
            $table->text('observaciones')->nullable();
            $table->char('status', 1)->default('A');
            $table->timestamps();

            $table->index(['fecha', 'tipo']);
            $table->index('matricula');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('operaciones_programadas');
    }
};
