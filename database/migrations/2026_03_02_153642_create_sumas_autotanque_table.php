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
        Schema::create('sumas_autotanque', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('id_turno');
            $table->decimal('litros', 10, 2);
            $table->string('folio', 50);
            $table->timestamps();

            $table->foreign('id_turno')
                  ->references('id')
                  ->on('turnos_autotanque')
                  ->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sumas_autotanque');
    }
};
