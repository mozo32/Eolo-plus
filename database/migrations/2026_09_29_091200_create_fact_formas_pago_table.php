<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Con qué se cobra: Visa, Amex, Efectivo, AvCard by WFS, Transferencia. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_formas_pago', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 60)->unique();
            $table->char('status', 1)->default('A')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_formas_pago');
    }
};
