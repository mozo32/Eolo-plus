<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `aeronaves` pasa a ser la tabla autoritativa de matrículas. Las altas
 * automáticas (una matrícula capturada en una operación que todavía no está en
 * el catálogo) no conocen el tipo de aeronave: en el sistema viejo se insertaba
 * con `id_tipo = 0`. Aquí se representa con null.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('aeronaves', function (Blueprint $table) {
            $table->unsignedBigInteger('aeronave_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('aeronaves', function (Blueprint $table) {
            $table->unsignedBigInteger('aeronave_id')->nullable(false)->change();
        });
    }
};
