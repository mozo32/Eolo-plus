<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Las versiones SUSTITUIDAS de una prefactura. La vigente vive en `fact_prefacturas`:
 * aquí solo entra lo que ya fue reemplazado, así que mientras nadie corrija nada la
 * tabla está vacía.
 *
 * `documento` guarda el contrato de la vista —lo que se imprimió, ya resuelto— y no las
 * filas del modelo, por la misma razón que existe el sello: si mañana cambia `importe()`,
 * reconstruir el documento desde las filas cambiaría lo que dice un papel que ya salió.
 *
 * CUIDADO con el rollback: `down()` borra la tabla con las versiones dentro, y
 * `migrate:rollback` a secas revierte el LOTE completo, no una migración (ver la guía de
 * despliegue del bloque 5). Después de desplegar esto, un rollback es pérdida de datos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_prefactura_versiones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('prefactura_id')->constrained('fact_prefacturas')->cascadeOnDelete();
            $table->unsignedSmallInteger('version');

            // Desnormalizado a propósito: una versión sin folio legible no sirve de nada,
            // y el folio de la prefactura puede no estar si alguien la dejó reabierta.
            $table->unsignedInteger('folio');

            // Mismos tipos que las columnas selladas de `fact_prefacturas`: decimal(12,2)
            // los tres montos y decimal(5,4) la tasa. Si divergieran, el sello guardado no
            // sería comparable con el que se verifica.
            $table->decimal('subtotal_sellado', 12, 2);
            $table->decimal('iva_sellado', 12, 2);
            $table->decimal('total_sellado', 12, 2);
            $table->decimal('iva_tasa_sellada', 5, 4);

            $table->timestamp('cerrada_at')->nullable();
            $table->foreignId('cerrada_por')->nullable()->constrained('users');

            // `dateTime` y no `timestamp`: en MySQL (sin explicit_defaults_for_timestamp) un
            // `timestamp` NOT NULL tras otro `timestamp` recibe default 0000-00-00 y la
            // migración falla con NO_ZERO_DATE. Sqlite no lo detecta.
            $table->dateTime('reabierta_at');
            $table->foreignId('reabierta_por')->nullable()->constrained('users');
            $table->string('motivo', 500);

            $table->json('documento');
            $table->timestamps();

            // La red del número de versión: dos sesiones reabriendo a la vez no pueden
            // escribir dos veces la 1.
            $table->unique(['prefactura_id', 'version']);
            $table->index('folio');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_prefactura_versiones');
    }
};
