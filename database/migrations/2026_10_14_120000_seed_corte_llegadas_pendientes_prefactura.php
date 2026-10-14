<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Desde qué día cuenta una llegada de Operaciones Diarias como pendiente de prefactura.
 *
 * Se siembra con la fecha en que corre la migración, no con una fecha escrita a mano: así
 * el día que esto llegue al servidor, la alerta empieza a contar desde ese mismo día y no
 * arrastra el rezago. Al medirlo había 1520 llegadas sin prefactura desde mayo de 2025;
 * ese inventario es otra decisión, pendiente del departamento, y no debe entrar por la
 * puerta de atrás en una alerta diaria.
 *
 * Se mueve editando la fila, sin tocar código.
 */
return new class extends Migration
{
    private const CLAVE = 'prefactura_llegadas_desde';

    public function up(): void
    {
        // `updateOrInsert` y no `insert`: si la fila ya existe, la fecha que alguien
        // haya puesto a mano es la buena y volver a correr esto no debe pisarla.
        DB::table('fact_configuracion')->updateOrInsert(
            ['clave' => self::CLAVE],
            [
                'valor' => now()->toDateString(),
                'descripcion' => 'Las llegadas anteriores a este día no cuentan como pendientes de prefactura.',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        );
    }

    public function down(): void
    {
        DB::table('fact_configuracion')->where('clave', self::CLAVE)->delete();
    }
};
