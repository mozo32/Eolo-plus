<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * El encabezado de una prefactura.
 *
 * `folio` es nulo mientras es borrador y único cuando no lo es: en MySQL y en
 * sqlite un índice único admite varios NULL, así que esto permite muchos
 * borradores sin folio y a la vez impide dos folios iguales, sin índice filtrado.
 *
 * Los totales se derivan de los renglones mientras es borrador. Las columnas
 * `*_sellado` se llenan al cerrar y son lo único redundante del modelo, a
 * propósito: una prefactura cerrada es un documento que ya salió al cliente y no
 * debe moverse si mañana alguien corrige un catálogo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_prefacturas', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('folio')->nullable()->unique();
            $table->string('estado', 10)->default('borrador')->index();
            $table->foreignId('aeronave_id')->constrained('aeronaves');
            $table->foreignId('cliente_id')->nullable()->constrained('fact_clientes')->nullOnDelete();
            $table->dateTime('llegada_at')->nullable();
            $table->dateTime('salida_at')->nullable();
            $table->string('origen', 120)->nullable();
            $table->string('destino', 120)->nullable();
            $table->foreignId('operacion_llegada_id')->nullable()->constrained('operaciones_diarias')->nullOnDelete();
            $table->foreignId('operacion_salida_id')->nullable()->constrained('operaciones_diarias')->nullOnDelete();
            $table->string('tipo_destino', 15)->default('nacional');
            $table->decimal('subtotal_sellado', 12, 2)->nullable();
            $table->decimal('iva_sellado', 12, 2)->nullable();
            $table->decimal('total_sellado', 12, 2)->nullable();
            $table->decimal('iva_tasa_sellada', 5, 4)->nullable();
            $table->dateTime('cerrada_at')->nullable();
            $table->foreignId('cerrada_por')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('user_id')->constrained('users');
            $table->char('status', 1)->default('A')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_prefacturas');
    }
};
