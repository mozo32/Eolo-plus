<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Tipo de motor y su tarifa de aterrizaje (en el sistema viejo, tb_aterrisaje). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_tipos_motor', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 60)->unique();
            $table->decimal('tarifa_aterrizaje', 10, 2);
            $table->char('status', 1)->default('A')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_tipos_motor');
    }
};
