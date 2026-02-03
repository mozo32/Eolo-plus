<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('movimientos_csae', function (Blueprint $table) {
            $table->id();
             $table->foreignId('user_entrada_id')
                ->constrained('users')
                ->cascadeOnDelete();

            $table->foreignId('user_salida_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            // ===== ENTRADA =====
            $table->dateTime('fecha_hora_entrada');
            $table->string('matricula', 20);
            $table->string('tipo_aeronave', 50);
            $table->string('como_llega', 50);
            $table->string('transportista', 100);
            $table->string('firma_entrada', 100);
            $table->text('observaciones_entrada')->nullable();

            // ===== SALIDA =====
            $table->dateTime('fecha_hora_salida')->nullable();
            $table->string('firma_salida', 100)->nullable();
            $table->text('observaciones_salida')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('movimientos_csae');
    }
};
