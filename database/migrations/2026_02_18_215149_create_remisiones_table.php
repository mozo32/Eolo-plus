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
        Schema::create('remisiones', function (Blueprint $column) {
            $column->id();
            $column->string('folio')->unique(); // ID: #8941
            $column->date('fecha');

            // Lógica de Vuelo
            $column->boolean('es_vuelo')->default(false);
            $column->string('cliente_vuelo')->nullable();
            $column->string('requisicion')->nullable();
            $column->string('forma_pago')->nullable();

            // Datos Aeronave
            $column->string('tipo_aeronave');
            $column->string('matricula');
            $column->string('destino');

            // Cronología
            $column->time('hora_llegada')->nullable();
            $column->time('hora_inicio')->nullable();
            $column->time('hora_final')->nullable();

            // Control de Flujo
            $column->unsignedBigInteger('lectura_inicial');
            $column->unsignedBigInteger('lectura_final');
            $column->integer('total_litros');

            // Cierre
            $column->text('observaciones')->nullable();
            $column->string('nombre_cliente_firma');
            $column->string('nombre_operador_firma');

            $column->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('remisiones');
    }
};
