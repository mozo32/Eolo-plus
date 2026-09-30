<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Quién presta el servicio cuando no lo presta Eolo.
 *
 * El sistema viejo tiene la columna pero no la usa: todos sus INSERT a
 * `tb_venta` escriben `Id_proveedor = 5` fijo, sea cual sea el servicio. Se
 * trae el catálogo por si el flujo de prefactura lo aprovecha, sin reproducir
 * ese valor fijo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_proveedores', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 120)->unique();
            $table->char('status', 1)->default('A')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_proveedores');
    }
};
