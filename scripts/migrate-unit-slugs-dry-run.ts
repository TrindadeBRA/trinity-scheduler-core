/**
 * Data Migration Script (DRY RUN): Preview slug generation for existing units
 * 
 * This script shows what slugs would be generated without modifying the database.
 * 
 * Usage:
 *   yarn tsx scripts/migrate-unit-slugs-dry-run.ts
 */

import { PrismaClient } from '@prisma/client';
import { generateSlug, sanitizeSlug, validateSlug, suggestAlternativeSlugs } from '../src/utils/slug';

const prisma = new PrismaClient();

async function dryRunMigration() {
  console.log('🔍 DRY RUN: Previewing unit slug migration...\n');

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
    console.log('='.repeat(70));
    console.log('Preview of slug generation:');
    console.log('='.repeat(70) + '\n');

    // Process each unit (preview only)
    for (const unit of unitsWithoutSlug) {
      // Generate slug from unit name
      let slug = generateSlug(unit.name);
      
      // Check if slug is valid
      const validation = validateSlug(slug);
      if (!validation.valid) {
        console.log(`⚠️  Unit: "${unit.name}"`);
        console.log(`   Generated invalid slug: "${slug}"`);
        console.log(`   Error: ${validation.error}`);
        console.log(`   Would use fallback: "unit-${unit.id.substring(0, 8)}"\n`);
        slug = `unit-${unit.id.substring(0, 8)}`;
      }

      // Check for uniqueness (case-insensitive)
      const normalizedSlug = slug.toLowerCase();
      if (existingSlugs.includes(normalizedSlug)) {
        const alternativeSlug = suggestAlternativeSlugs(slug, existingSlugs);
        console.log(`🔄 Unit: "${unit.name}"`);
        console.log(`   Slug "${slug}" already exists`);
        console.log(`   Would use: "${alternativeSlug}"\n`);
        slug = alternativeSlug;
      } else {
        console.log(`✅ Unit: "${unit.name}"`);
        console.log(`   Would generate slug: "${slug}"\n`);
      }

      // Add to existing slugs to prevent duplicates in this preview
      existingSlugs.push(slug.toLowerCase());
    }

    console.log('='.repeat(70));
    console.log(`\n📊 Summary: ${unitsWithoutSlug.length} units would be updated`);
    console.log('\n💡 To apply these changes, run: yarn tsx scripts/migrate-unit-slugs.ts');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('💥 Error during dry run:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the dry run
dryRunMigration()
  .catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
