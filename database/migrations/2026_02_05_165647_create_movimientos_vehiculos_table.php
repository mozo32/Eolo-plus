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
        Schema::create('movimientos_vehiculos', function (Blueprint $table) {
            $table->id();
            $table->string('vehiculo_id');
            $table->enum('tipo', ['Entrada', 'Salida']);
            $table->string('chofer');
            $table->integer('kilometraje');
            $table->string('gasolina');
            $table->string('destino')->nullable();
            $table->string('autoriza')->nullable();
            $table->text('observaciones')->nullable();

            $table->foreign('vehiculo_id')
                  ->references('id')
                  ->on('vehiculos')
                  ->onDelete('cascade');

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('movimientos_vehiculos');
    }
};
