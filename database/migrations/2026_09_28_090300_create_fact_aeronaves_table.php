<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Atributos de la matrícula que solo importan para cobrar. Van aparte de
 * `aeronaves` porque esa tabla la usan módulos que no facturan; una matrícula
 * que nunca se factura simplemente no tiene fila aquí.
 *
 * `categoria_aeronave_id` nula reproduce el `id_categoria = 0` del sistema
 * viejo: la matrícula existe pero todavía no se puede facturar.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_aeronaves', function (Blueprint $table) {
            $table->id();
            $table->foreignId('aeronave_id')->unique()->constrained('aeronaves')->cascadeOnDelete();
            $table->foreignId('categoria_aeronave_id')->nullable()->constrained('fact_categorias_aeronave')->nullOnDelete();
            $table->foreignId('tipo_motor_id')->nullable()->constrained('fact_tipos_motor')->nullOnDelete();
            $table->string('estatus', 10)->default('guarda')->index();
            $table->boolean('cobra_derecho_vuelos')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_aeronaves');
    }
};
