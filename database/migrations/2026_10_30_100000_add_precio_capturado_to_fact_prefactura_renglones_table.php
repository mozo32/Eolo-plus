<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Marca el renglón cuyo precio se tecleó al agregarlo, en vez de heredarlo del catálogo, de la
 * remisión, del comisariato o de la tarifa de la aeronave.
 *
 * Nace en `false` y eso es la verdad de las filas que ya existen: hasta este trabajo el
 * navegador no podía mandar un precio, así que ninguna se capturó a mano. No hay relleno.
 *
 * Sin índice a propósito: se lee siempre junto a su renglón y nunca se filtra por este campo.
 * Un índice aquí tendría nombre automático largo, y MySQL rechaza los de más de 64 caracteres
 * mientras sqlite —donde corren las pruebas— los acepta.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fact_prefactura_renglones', function (Blueprint $tabla) {
            $tabla->boolean('precio_capturado')->default(false)->after('precio_unitario');
        });
    }

    public function down(): void
    {
        Schema::table('fact_prefactura_renglones', function (Blueprint $tabla) {
            $tabla->dropColumn('precio_capturado');
        });
    }
};
