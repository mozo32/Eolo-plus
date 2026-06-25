<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('checklist_turnos', function (Blueprint $table) {
            $table->integer('cantidad_transito')->default(0)->after('cantidad_internacionales');
            $table->integer('cantidad_guarda')->default(0)->after('cantidad_transito');
            $table->integer('cantidad_aerotaxi')->default(0)->after('cantidad_guarda');
            $table->integer('cantidad_mantenimiento')->default(0)->after('cantidad_aerotaxi');
            $table->integer('cantidad_handling')->default(0)->after('cantidad_mantenimiento');
            $table->integer('cantidad_equipaje')->default(0)->after('cantidad_pasajeros');
        });
    }

    public function down(): void
    {
        Schema::table('checklist_turnos', function (Blueprint $table) {
            $table->dropColumn([
                'cantidad_transito',
                'cantidad_guarda',
                'cantidad_aerotaxi',
                'cantidad_mantenimiento',
                'cantidad_handling',
                'cantidad_equipaje',
            ]);
        });
    }
};
