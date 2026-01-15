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
        Schema::create('walkaround_checklists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('walk_around_id')->constrained('walk_arounds')->cascadeOnDelete();

            $table->json('checklist_avion')->nullable();
            $table->json('checklist_helicoptero')->nullable();
            $table->char('status', 1)->default('A');
            $table->timestamps();

            $table->unique('walk_around_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('walkaround_checklists');
    }
};
