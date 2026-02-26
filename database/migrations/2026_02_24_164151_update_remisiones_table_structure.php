<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('remisiones', function (Blueprint $table) {
            // 1. Eliminamos los campos que ya no usaremos
            $table->dropColumn([
                'es_vuelo',
                'cliente_vuelo',
                'tipo_aeronave',
                'nombre_cliente_firma',
                'nombre_operador_firma',
                'observaciones'
            ]);

            // 2. Modificamos los numéricos (esto no suele dar problemas)
            $table->decimal('lectura_inicial', 12, 2)->change();
            $table->decimal('lectura_final', 12, 2)->change();
            $table->decimal('total_litros', 12, 2)->change();

            /**
             * 3. CORRECCIÓN PARA EL ERROR DE LONGITUD:
             * Cambiamos a varchar(8) en lugar de 5 para que quepa el formato "HH:MM:SS"
             * que ya existe en tus registros de producción.
             */
            $table->string('hora_llegada', 8)->nullable()->change();
            $table->string('hora_inicio', 8)->nullable()->change();
            $table->string('hora_final', 8)->nullable()->change();

            // 4. Añadimos los campos nuevos
            $table->string('operador')->after('fecha');
            $table->string('unidad')->default('PIPA 1 · EP01')->after('operador');
            $table->string('producto')->default('TURBOSINA')->after('unidad');
            $table->string('cliente')->after('producto');
            $table->string('aeronave_tipo')->after('forma_pago');
            $table->char('status', 1)->default('A')->after('total_litros');

            // 5. Renombramos después de haber cambiado el tipo
            $table->renameColumn('hora_inicio', 'hora_inicial');
        });

        // OPCIONAL: Si quieres limpiar los segundos de los datos viejos para que queden "HH:MM"
        // DB::statement("UPDATE remisiones SET hora_llegada = LEFT(hora_llegada, 5), hora_inicial = LEFT(hora_inicial, 5), hora_final = LEFT(hora_final, 5)");
    }

    public function down(): void
    {
        Schema::table('remisiones', function (Blueprint $table) {
            $table->renameColumn('hora_inicial', 'hora_inicio');
            $table->dropColumn(['operador', 'unidad', 'producto', 'cliente', 'aeronave_tipo', 'status']);

            // Regresamos a la estructura original si es necesario
            $table->boolean('es_vuelo')->default(false);
            $table->string('cliente_vuelo')->nullable();
            $table->string('tipo_aeronave')->nullable();
            $table->text('observaciones')->nullable();
            $table->string('nombre_cliente_firma')->nullable();
            $table->string('nombre_operador_firma')->nullable();
        });
    }
};
