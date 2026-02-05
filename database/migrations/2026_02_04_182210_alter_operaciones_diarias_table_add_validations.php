<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('operaciones_diarias', function (Blueprint $table) {
            $table->json('validaciones')->nullable()->after('pax');
            $table->string('departamento')->after('validaciones');
            $table->string('lugar')->comment('Origen o Destino según tipo')->change();
        });
    }

    public function down(): void
    {
        Schema::table('operaciones_diarias', function (Blueprint $table) {
            $table->dropColumn(['validaciones', 'departamento']);
        });
    }
};
