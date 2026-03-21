/**
 * Data Migration Script: Populate slugs for existing units
 * 
 * This script generates slugs for all units that don't have one yet.
 * It ensures uniqueness by adding numeric suffixes when necessary.
 * 
 * Usage:
 *   yarn tsx scripts/migrate-unit-slugs.ts
 */

import { PrismaClient } from '@prisma/client';
import { generateSlug, sanitizeSlug, validateSlug, suggestAlternativeSlugs } from '../src/utils/slug';

const prisma = new PrismaClient();

async function migrateUnitSlugs() {
  console.log('🚀 Starting unit slug migration...\n');

  try {
    // Find all units without a slug
    const unitsWithoutSlug = await prisma.unit.findMany({
      where: {
        slug: null
      },
      select: {
        id: true,
        name: true,
        shopId: true
      }
    });

    console.log(`📊 Found ${unitsWithoutSlug.length} units without slugs\n`);

    if (unitsWithoutSlug.length === 0) {
      console.log('✅ All units already have slugs. Nothing to migrate.');
      return;
    }

    // Get all existing slugs to check for conflicts
    const existingUnits = await prisma.unit.findMany({
      where: {
        slug: {
          not: null
        }
      },
      select: {
        slug: true
      }
    });

    const existingSlugs = existingUnits.map(u => u.slug!.toLowerCase());
    console.log(`📋 Found ${existingSlugs.length} existing slugs in database\n`);

    let successCount = 0;
    let errorCount = 0;

    // Process each unit
    for (const unit of unitsWithoutSlug) {
      try {
        // Generate slug from unit name
        let slug = generateSlug(unit.name);
        
        // Check if slug is valid
        const validation = validateSlug(slug);
        if (!validation.valid) {
          console.log(`⚠️  Generated invalid slug for unit "${unit.name}": ${validation.error}`);
          // Use fallback slug
          slug = `unit-${unit.id.substring(0, 8)}`;
        }

        // Check for uniqueness (case-insensitive)
        const normalizedSlug = slug.toLowerCase();
        if (existingSlugs.includes(normalizedSlug)) {
          // Slug already exists, suggest alternative
          const alternativeSlug = suggestAlternativeSlugs(slug, existingSlugs);
          console.log(`🔄 Slug "${slug}" already exists. Using "${alternativeSlug}" instead.`);
          slug = alternativeSlug;
        }

        // Update the unit with the generated slug
        await prisma.unit.update({
          where: { id: unit.id },
          data: { slug }
        });

        // Add to existing slugs to prevent duplicates in this batch
        existingSlugs.push(slug.toLowerCase());

        console.log(`✅ Unit "${unit.name}" → slug: "${slug}"`);
        successCount++;

      } catch (error) {
        console.error(`❌ Error processing unit "${unit.name}" (${unit.id}):`, error);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`📈 Migration Summary:`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📊 Total: ${unitsWithoutSlug.length}`);
    console.log('='.repeat(50) + '\n');

    if (errorCount === 0) {
      console.log('🎉 Migration completed successfully!');
    } else {
      console.log('⚠️  Migration completed with errors. Please review the logs above.');
    }

  } catch (error) {
    console.error('💥 Fatal error during migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateUnitSlugs()
  .catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
