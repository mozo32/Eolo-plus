<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * «Esta remisión se excluyó A MANO de esta prefactura».
 *
 * La sincronización corre en cada carga de la pantalla, y eso es deliberado: es lo que hace
 * que llegue una remisión que Rampa capturó tarde. Pero quitar el renglón LIBERA la remisión
 * (`RemisionesFacturables` la vuelve a ver libre en cuanto su renglón desaparece), así que lo
 * que el operador quitaba a propósito volvía a entrar solo en la siguiente carga.
 *
 * Se arregla recordando la decisión, no capando la sincronización. Y en una tabla aparte, no
 * con un borrado suave en `fact_prefactura_renglones`: esos renglones se borran de verdad y la
 * tabla no tiene `deleted_at`.
 *
 * La exclusión es de la PAREJA prefactura + remisión, no de la remisión: excluirla de este
 * documento no dice nada de los demás. Y se REVOCA al darla de alta a mano en esa misma
 * prefactura: volver a ponerla a propósito es deshacer la decisión anterior.
 *
 * Las dos claves van en cascada: si la prefactura o la remisión desaparecen, la exclusión no
 * significa nada.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_prefactura_remisiones_excluidas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('prefactura_id')->constrained('fact_prefacturas')->cascadeOnDelete();
            $table->foreignId('remision_id')->constrained('remisiones')->cascadeOnDelete();
            // Quién la excluyó: la bitácora guarda el hecho, esto lo deja al alcance de la consulta.
            $table->foreignId('user_id')->constrained('users');
            $table->timestamps();

            // Una sola exclusión por pareja: quitar y volver a quitar es la misma decisión.
            $table->unique(['prefactura_id', 'remision_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_prefactura_remisiones_excluidas');
    }
};
