<?php
// database/migrations/2026_09_29_091400_create_fact_servicios_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Catálogo de servicios facturables.
 *
 * El sistema viejo decidía el recargo de tercero por el número de id (`> 93`) y
 * los ajustes de precio con tres `if` sobre los ids 106, 107 y 113. Aquí son
 * columnas: insertar un servicio nuevo ya no rompe la regla.
 *
 * El precio lleva cuatro decimales porque el origen los usa: `Combustible
 * JET A-1` vale 26.0640. Con dos, el cobro cambiaría.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_servicios', function (Blueprint $table) {
            $table->id();
            $table->foreignId('categoria_servicio_id')
                ->nullable()
                ->constrained('fact_categorias_servicio')
                ->nullOnDelete();
            $table->string('nombre', 120)->index();
            $table->decimal('precio_unitario', 10, 4)->default(0);
            $table->boolean('es_de_tercero')->default(false);
            $table->decimal('margen', 5, 2)->default(0);
            $table->string('ajuste_precio', 16)->default('ninguno');
            $table->char('status', 1)->default('A')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_servicios');
    }
};
