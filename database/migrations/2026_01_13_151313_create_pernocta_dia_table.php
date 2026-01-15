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
        Schema::create('pernocta_dia', function (Blueprint $table) {
            $table->id();
            $table->date('fecha');
            $table->string('matricula', 20);
            $table->string('nombre', 120)->nullable();
            $table->text('observaciones')->nullable();
            $table->string('ubicacion', 120)->nullable();
            $table->string('aeronave', 120)->nullable();
            $table->string('tipo_cliente', 120)->nullable();
            $table->string('categoria', 120)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pernocta_dia');
    }
};
