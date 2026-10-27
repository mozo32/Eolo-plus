<?php

use App\Services\RellenarProveedorDeComisariatos;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * El proveedor del comisariato deja de ser texto libre.
 *
 * `catering` se queda como historia y deja de escribirse: es lo que tecleó alguien antes de que
 * existiera la lista. La columna nueva apunta al servicio del catálogo, que es lo que determina
 * el margen y el ajuste con los que se cobrará.
 *
 * Nullable porque las filas existentes no tienen proveedor elegido y no se les inventa uno.
 * `restrictOnDelete` porque un servicio que ya identificó un comisariato no debe poder
 * desaparecer y dejar el registro sin explicación; el catálogo además no borra, desactiva.
 *
 * El relleno de las filas existentes vive en `RellenarProveedorDeComisariatos`, que tiene sus
 * propias pruebas: dentro de la migración no se podría probar con filas.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('servicio_comisariatos', function (Blueprint $tabla) {
            $tabla->foreignId('fact_servicio_id')
                ->nullable()
                ->after('catering')
                ->constrained('fact_servicios')
                ->restrictOnDelete();
        });

        (new RellenarProveedorDeComisariatos)();
    }

    public function down(): void
    {
        Schema::table('servicio_comisariatos', function (Blueprint $tabla) {
            $tabla->dropForeign(['fact_servicio_id']);
            $tabla->dropColumn('fact_servicio_id');
        });
    }
};
