<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La etiqueta de agrupación de un renglón. Los renglones de una prefactura que comparten
 * etiqueta se imprimen como UNA fila, con la suma de sus importes.
 *
 * Es solo de presentación: no entra en ningún cálculo. En el sistema viejo agrupar ponía
 * a cero el importe de los renglones elegidos y creaba un renglón «Otros» con la suma; en
 * el folio 932 del histórico se pusieron a cero dos renglones por 14,344.00 y el «Otros»
 * nunca se creó, así que se cerró cobrando 17,755.00 cuando debían ser 32,099.00. Aquí el
 * dinero no se toca, así que esa pérdida no es posible.
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
