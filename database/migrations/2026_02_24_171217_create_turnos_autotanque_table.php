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
        Schema::create('turnos_autotanque', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')
                  ->constrained('users')
                  ->onDelete('cascade');
            // --- Datos de Apertura (Inicio) ---
            $table->string('nombre');
            $table->dateTime('fecha');
            $table->integer('cmIni');
            $table->decimal('litrosIni', 12, 2);
            $table->unsignedBigInteger('totalizadorIni');

            // --- Datos de Cierre ---
            $table->string('nombreCierre');
            $table->dateTime('fechaCierre');
            $table->integer('cmCierre');
            $table->decimal('litrosCierre', 12, 2);
            $table->unsignedBigInteger('totalizadorCierre');

            // --- Resumen y Balance ---
            $table->decimal('totalVendidos', 12, 2);
            $table->decimal('balanceAritmetico', 12, 2);
            $table->decimal('balanceFisico', 12, 2);
            $table->decimal('diferenciaFinal', 12, 2);

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('turnos_autotanque');
    }
};
