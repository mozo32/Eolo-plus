<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La etiqueta de agrupación de un renglón. Existe para que los renglones de una prefactura
 * que la comparten se impriman como UNA sola fila, con la suma de sus importes.
 *
 * Está pensada solo para la presentación: no debe entrar en ningún cálculo. En el sistema
 * viejo agrupar ponía a cero el importe de los renglones elegidos y creaba un renglón
 * «Otros» con la suma. Se usó 5 veces en casi dos años y en 4 el «Otros» cuadró; en la
 * quinta, el folio 932 del histórico, se pusieron a cero dos renglones por 14,344.00 y el
 * «Otros» nunca se creó, así que se cerró cobrando 17,755.00 cuando debían ser 32,099.00.
 * Por eso la función se rediseñó en lugar de arreglarse: aquí el dinero no se toca, y esa
 * pérdida no es posible.
 *
 * La etiqueta ES la identidad del grupo: dos renglones con la misma etiqueta son el mismo
 * grupo. No hay forma de tener dos grupos llamados igual, y es deliberado: a cambio,
 * desagrupar es poner la columna a `null` y la etiqueta impresa no necesita catálogo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fact_prefactura_renglones', function (Blueprint $table) {
            $table->string('grupo', 60)->nullable()->index()->after('remision');
        });
    }

    public function down(): void
    {
        Schema::table('fact_prefactura_renglones', function (Blueprint $table) {
            $table->dropIndex(['grupo']);
            $table->dropColumn('grupo');
        });
    }
};
