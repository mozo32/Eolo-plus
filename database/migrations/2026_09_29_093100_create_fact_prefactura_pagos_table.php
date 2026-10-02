<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Los pagos de una prefactura.
 *
 * En el histórico nunca hay más de dos por folio (3,498 folios con uno, 18 con
 * dos), pero la tabla no lo limita: limitarlo no compra nada y cerraría la puerta
 * a un cobro en tres partes que el viejo nunca necesitó pero tampoco prohibía.
 *
 * NO se guarda el cambio: se deriva de los pagos y el total. El `Cambio` del
 * sistema viejo está mal en las dos direcciones —de los 27 folios sobrepagados
 * solo 15 lo tienen distinto de cero, y de los 18 que lo tienen, 3 no están
 * sobrepagados— porque casi toda rama de `mpago.php` que inserta un pago hace
 * `SET Cambio='0'` y pisa el que el efectivo había dejado.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_prefactura_pagos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('prefactura_id')->constrained('fact_prefacturas')->cascadeOnDelete();
            $table->foreignId('forma_pago_id')->constrained('fact_formas_pago');
            $table->decimal('monto', 12, 2);
            // Solo Amex: el renglón de comisión que ESTE pago creó, para poder quitarlo
            // al quitar el pago. `nullOnDelete` y no cascada: si el renglón se va por otra
            // vía, el pago sobrevive sin referencia colgada en lugar de desaparecer.
            $table->foreignId('renglon_comision_id')->nullable()->constrained('fact_prefactura_renglones')->nullOnDelete();
            $table->foreignId('user_id')->constrained('users');
            $table->char('status', 1)->default('A')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_prefactura_pagos');
    }
};
