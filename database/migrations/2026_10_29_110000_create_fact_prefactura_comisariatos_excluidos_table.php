<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La decisión del operador de que ESTE comisariato no va en ESTA prefactura.
 *
 * Sin esto, quitar el renglón libera el comisariato y la siguiente carga de la pantalla
 * —que sincroniza siempre, y eso es deliberado— lo vuelve a meter con su importe.
 *
 * Hermana de `fact_prefactura_remisiones_excluidas`. NO se generalizan en una sola tabla:
 * serían dos conceptos distintos metidos en una abstracción que nadie ha pedido.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_prefactura_comisariatos_excluidos', function (Blueprint $tabla) {
            $tabla->id();
            $tabla->foreignId('prefactura_id')->constrained('fact_prefacturas')->cascadeOnDelete();
            // Nombre explícito y corto: el automático de Laravel
            // (`fact_prefactura_comisariatos_excluidos_servicio_comisariato_id_foreign`) mide 70
            // caracteres, pasa de los 64 que admite MySQL y la migración fallaría entera.
            // Le pasó a la tabla hermana. SQLite no tiene ese límite: las pruebas no lo detectan.
            $tabla->foreignId('servicio_comisariato_id')
                ->constrained('servicio_comisariatos', 'id', 'fact_prefactura_comisariato_excluido_servicio_fk')
                ->cascadeOnDelete();
            $tabla->foreignId('user_id')->constrained('users');
            $tabla->timestamps();

            $tabla->unique(['prefactura_id', 'servicio_comisariato_id'], 'fact_prefactura_comisariato_excluido_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_prefactura_comisariatos_excluidos');
    }
};
