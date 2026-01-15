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
        Schema::create('walk_arounds', function (Blueprint $table) {
            $table->id();
            $table->date('fecha');
            $table->enum('movimiento', ['entrada', 'salida']);
            $table->string('matricula', 20);

            $table->unsignedBigInteger('tipo_aeronave_id');
            $table->enum('tipo', ['avion', 'helicoptero']);

            $table->time('hora')->nullable();
            $table->string('destino', 120)->nullable();
            $table->string('procedensia', 120)->nullable();

            $table->text('observaciones')->nullable();
            $table->unsignedBigInteger('elabora_departamento_id')->nullable();
            $table->unsignedBigInteger('elabora_personal_id')->nullable();
            $table->string('elabora', 120)->nullable();
            $table->string('responsable', 120)->nullable();
            $table->string('jefe_area', 120)->nullable();
            $table->string('fbo', 120)->nullable();
            $table->unsignedInteger('numero_estaticas')->nullable();
            $table->char('status', 1)->default('A');
            $table->timestamps();

            $table->index(['fecha', 'movimiento']);
            $table->index('matricula');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('walk_arounds');
    }
};
