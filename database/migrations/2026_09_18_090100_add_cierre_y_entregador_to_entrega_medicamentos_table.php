<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Dos datos que faltaban en las entregas de medicamento:
 *
 * - control_medicamento_id: el cierre de turno que finalizó la entrega. Hasta
 *   ahora el cierre solo pasaba las entregas de A a N; con esto el PDF puede
 *   listar las entregas de cada turno.
 * - entregado_por_user_id: la persona que realmente entregó. user_id sigue
 *   siendo quien capturó (auditoría).
 *
 * El backfill reconstruye el histórico con la misma regla que aplicaba el
 * cierre: cada cierre se lleva las entregas cerradas anteriores a él que
 * todavía no tengan cierre.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('entrega_medicamentos', function (Blueprint $table) {
            $table->foreignId('control_medicamento_id')
                ->nullable()
                ->after('user_id')
                ->constrained('control_medicamentos')
                ->nullOnDelete();

            $table->foreignId('entregado_por_user_id')
                ->nullable()
                ->after('control_medicamento_id')
                ->constrained('users')
                ->nullOnDelete();
        });

        $cierres = DB::table('control_medicamentos')
            ->orderBy('created_at')
            ->orderBy('id')
            ->get(['id', 'created_at']);

        foreach ($cierres as $cierre) {
            DB::table('entrega_medicamentos')
                ->where('status', 'N')
                ->whereNull('control_medicamento_id')
                ->where('created_at', '<=', $cierre->created_at)
                ->update(['control_medicamento_id' => $cierre->id]);
        }
    }

    public function down(): void
    {
        Schema::table('entrega_medicamentos', function (Blueprint $table) {
            $table->dropConstrainedForeignId('entregado_por_user_id');
            $table->dropConstrainedForeignId('control_medicamento_id');
        });
    }
};
