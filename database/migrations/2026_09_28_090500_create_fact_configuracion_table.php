<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Constantes del módulo que en el sistema viejo estaban escritas en el código.
 * Se siembran aquí con los valores exactos que usa Prefacturas hoy, para que
 * ningún cobro cambie al migrar.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_configuracion', function (Blueprint $table) {
            $table->id();
            $table->string('clave', 60)->unique();
            $table->string('valor', 60);
            $table->string('descripcion', 200);
            $table->timestamps();
        });

        DB::table('fact_configuracion')->insert([
            [
                'clave' => 'combustible_ajuste',
                'valor' => '0.50',
                'descripcion' => 'Se suma al precio ASA antes del margen (actualizar_combustible.php).',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'clave' => 'combustible_margen',
                'valor' => '1.15',
                'descripcion' => 'Multiplicador sobre el precio ASA ajustado para obtener el precio Eolo.',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_configuracion');
    }
};
