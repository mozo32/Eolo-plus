<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('estacionamiento_subterraneos', function (Blueprint $table) {
            $table->string('llaves', 5)->default('NO')->after('matricula');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('estacionamiento_subterraneos', function (Blueprint $table) {
            $table->dropColumn('llaves');
        });
    }
};
