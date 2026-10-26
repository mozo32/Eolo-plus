<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * El enlace entre un renglón de combustible y la remisión de la que nació.
 *
 * Vive aquí y no en `remisiones` a propósito: quitar el renglón o descartar la prefactura
 * liberan la remisión sin que nadie tenga que acordarse de limpiar nada. Si el enlace
 * estuviera del otro lado, cada sitio que lo olvidara dejaría una remisión bloqueada para
 * siempre sin que nadie supiera por qué.
 *
 * OJO con el nombre: esta tabla YA tiene una columna `remision`, un varchar con el número
 * de remisión del PROVEEDOR que se captura a mano. No es esto.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fact_prefactura_renglones', function (Blueprint $table) {
            $table->foreignId('remision_combustible_id')
                ->nullable()
                ->after('remision')
                ->constrained('remisiones')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('fact_prefactura_renglones', function (Blueprint $table) {
            $table->dropConstrainedForeignId('remision_combustible_id');
        });
    }
};
