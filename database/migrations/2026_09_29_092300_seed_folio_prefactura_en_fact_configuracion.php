<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Siembra el contador del folio de prefactura, como ya se hace con la configuración
 * del combustible.
 *
 * La fila existe ANTES del primer cierre a propósito: si el cierre la creara (aun con
 * `insertOrIgnore`), correría un INSERT en cada cierre, y sobre una fila existente
 * InnoDB toma candado compartido por el duplicado; dos sesiones lo obtienen a la vez
 * y luego las dos piden el exclusivo del `lockForUpdate()`: deadlock (ERROR 1213).
 * Sembrada aquí, `CierrePrefactura` solo lee con `lockForUpdate()` e incrementa.
 *
 * La serie arranca en 10000: el mayor folio del sistema viejo es 4121 y sus
 * borradores abiertos llegan a 4123.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('fact_configuracion')->insertOrIgnore([
            'clave' => 'prefactura_folio_siguiente',
            'valor' => '10000',
            'descripcion' => 'Siguiente folio de prefactura. La serie propia del bloque 2 arranca en 10000.',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('fact_configuracion')->where('clave', 'prefactura_folio_siguiente')->delete();
    }
};
