<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * La tercera versión del relevo de turno de Seguridad.
 *
 * Se va el puesto. La v2 sustituyó las casillas por conteos leídos de los
 * demás módulos, y esa consulta automática dejó sin razón de ser a llenar el
 * relevo dos veces al día: uno basta, y no hace falta decir desde dónde.
 *
 * Los relevos que ya existen conservan fecha, firmas, observaciones y
 * resumen; solo pierden la etiqueta del puesto. El `down()` devuelve la
 * columna pero NO sus valores: eso se pierde de verdad, y está aceptado.
 */
return new class extends Migration
{
    private const INDICE_VIEJO = 'entregas_turno_seg_fecha_seccion_idx';

    private const INDICE_NUEVO = 'entregas_turno_seg_fecha_idx';

    /**
     * El texto de cero, antes y después.
     *
     * Un relevo cerrado guarda su resumen y deja de consultar, así que sin
     * esta reescritura los relevos ya firmados seguirían diciendo «Sin
     * registros» para siempre.
     *
     * @var array<string, string>
     */
    private const TEXTOS = [
        'Sin registros' => 'No hay movimientos',
        'Sin pernoctas' => 'No hay pernoctas',
    ];

    public function up(): void
    {
        /*
         * La reescritura va PRIMERO: si la migración fallara a medio camino,
         * es mejor haber perdido una frase que una columna.
         */
        $this->reescribirTextos(self::TEXTOS);

        /*
         * Soltar el índice no es opcional: sqlite —el motor de las pruebas— se
         * niega a borrar una columna que está indexada. En MySQL el índice
         * sobreviviría degradado a `(fecha_hora)` con un nombre que menciona
         * una columna inexistente, que es peor que un error: funciona y miente.
         *
         * Van en tres llamadas separadas porque dentro de un mismo Blueprint
         * no está garantizado que el dropIndex corra antes del dropColumn.
         */
        Schema::table('entregas_turno_seguridad', function (Blueprint $table) {
            $table->dropIndex(self::INDICE_VIEJO);
        });

        Schema::table('entregas_turno_seguridad', function (Blueprint $table) {
            $table->dropColumn('seccion');
        });

        Schema::table('entregas_turno_seguridad', function (Blueprint $table) {
            $table->index(['fecha_hora'], self::INDICE_NUEVO);
        });
    }

    public function down(): void
    {
        Schema::table('entregas_turno_seguridad', function (Blueprint $table) {
            $table->dropIndex(self::INDICE_NUEVO);
        });

        /*
         * El valor por omisión es `caseta` para que la columna pueda volver a
         * ser NOT NULL sobre filas que ya existen. Los puestos originales no
         * vuelven.
         */
        Schema::table('entregas_turno_seguridad', function (Blueprint $table) {
            $table->string('seccion', 16)->default('caseta');
        });

        Schema::table('entregas_turno_seguridad', function (Blueprint $table) {
            $table->index(['fecha_hora', 'seccion'], self::INDICE_VIEJO);
        });

        $this->reescribirTextos(array_flip(self::TEXTOS));
    }

    /**
     * Cambia el texto de los resúmenes YA congelados, sin tocar sus cifras.
     *
     * Las cifras —`entradas`, `salidas`, `total`— son lo que hace del relevo
     * un documento, y cambiarlas sería falsificarlo. Cambiar una frase que se
     * deriva de ellas no cambia lo que el documento dice.
     *
     * `json_encode` va sin banderas, igual que el cast del modelo, para no
     * dejar unos relevos con los acentos escapados y otros no.
     *
     * @param  array<string, string>  $cambios
     */
    private function reescribirTextos(array $cambios): void
    {
        DB::table('entregas_turno_seguridad')
            ->whereNotNull('resumen')
            ->orderBy('id')
            ->each(function (object $fila) use ($cambios): void {
                $renglones = json_decode((string) $fila->resumen, true);

                if (! is_array($renglones)) {
                    return;
                }

                $nuevos = array_map(static function (mixed $renglon) use ($cambios): mixed {
                    if (! is_array($renglon) || ! is_string($renglon['texto'] ?? null)) {
                        return $renglon;
                    }

                    $renglon['texto'] = $cambios[$renglon['texto']] ?? $renglon['texto'];

                    return $renglon;
                }, $renglones);

                if ($nuevos === $renglones) {
                    return;
                }

                DB::table('entregas_turno_seguridad')
                    ->where('id', $fila->id)
                    ->update(['resumen' => json_encode($nuevos)]);
            });
    }
};
