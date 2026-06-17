<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bitacoras', function (Blueprint $table) {
            $table->unsignedBigInteger('registro_id')
                ->nullable()
                ->after('accion')
                ->index();

            $table->json('datos_anteriores')
                ->nullable()
                ->after('descripcion');

            $table->json('datos_nuevos')
                ->nullable()
                ->after('datos_anteriores');
        });
    }

    public function down(): void
    {
        Schema::table('bitacoras', function (Blueprint $table) {
            $table->dropColumn([
                'registro_id',
                'datos_anteriores',
                'datos_nuevos',
            ]);
        });
    }
};
