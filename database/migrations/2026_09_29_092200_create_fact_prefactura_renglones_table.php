<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Los renglones de una prefactura.
 *
 * El renglón CONGELA todo lo que determina su importe: nombre, precio, margen y
 * ajuste tal como estaban al capturarlo. Si mañana alguien edita el catálogo,
 * ningún documento se mueve. El sistema viejo ya lo hace con `precio_u`.
 *
 * `importe` NO se guarda: se deriva. Guardarlo es exactamente la redundancia que
 * produjo los 37 encabezados del sistema viejo cuyo total no corresponde a sus
 * renglones, el peor por 29,000 pesos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_prefactura_renglones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('prefactura_id')->constrained('fact_prefacturas')->cascadeOnDelete();
            $table->foreignId('servicio_id')->constrained('fact_servicios');
            $table->string('nombre_servicio', 120);
            $table->decimal('precio_unitario', 10, 4);
            $table->unsignedInteger('cantidad');
            $table->boolean('es_de_tercero')->default(false);
            $table->decimal('margen', 5, 2)->default(0);
            $table->string('ajuste_precio', 16)->default('ninguno');
            $table->string('concepto', 32)->nullable()->index();
            $table->foreignId('proveedor_id')->nullable()->constrained('fact_proveedores')->nullOnDelete();
            $table->string('remision', 255)->nullable();
            $table->unsignedSmallInteger('orden')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_prefactura_renglones');
    }
};
