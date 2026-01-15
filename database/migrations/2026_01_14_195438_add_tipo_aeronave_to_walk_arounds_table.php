<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('walk_arounds', function (Blueprint $table) {
            $table
                ->string('tipo_aeronave')
                ->nullable()
                ->after('tipo');
        });
    }

    public function down(): void
    {
        Schema::table('walk_arounds', function (Blueprint $table) {
            $table->dropColumn('tipo_aeronave');
        });
    }
};
