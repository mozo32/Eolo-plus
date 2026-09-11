<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('operacion_programada_usos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('operacion_programada_id')
                ->constrained('operaciones_programadas')
                ->cascadeOnDelete();
            $table->string('usable_type', 100);
            $table->unsignedBigInteger('usable_id');
            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamps();

            $table->unique(
                ['operacion_programada_id', 'usable_type'],
                'operacion_programada_usos_unico_por_modulo'
            );
            $table->index(['usable_type', 'usable_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('operacion_programada_usos');
    }
};
