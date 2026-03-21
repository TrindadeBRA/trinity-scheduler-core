/**
 * Verification Script: Check slug status for all units
 * 
 * This script displays the current slug status of all units in the database.
 * 
 * Usage:
 *   yarn tsx scripts/verify-slugs.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyUnitSlugs() {
  console.log('🔍 Verifying unit slugs...\n');

  try {
    // Get all units
    const allUnits = await prisma.unit.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        shopId: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log(`📊 Total units in database: ${allUnits.length}\n`);

    if (allUnits.length === 0) {
      console.log('ℹ️  No units found in database.');
      return;
    }

    const unitsWithSlug = allUnits.filter(u => u.slug !== null);
    const unitsWithoutSlug = allUnits.filter(u => u.slug === null);

    console.log('='.repeat(70));
    console.log('Units with slugs:');
    console.log('='.repeat(70) + '\n');

    if (unitsWithSlug.length > 0) {
      unitsWithSlug.forEach((unit, index) => {
        console.log(`${index + 1}. "${unit.name}"`);
        console.log(`   Slug: ${unit.slug}`);
        console.log(`   ID: ${unit.id}\n`);
      });
    } else {
      console.log('❌ No units have slugs yet.\n');
    }

    if (unitsWithoutSlug.length > 0) {
      console.log('='.repeat(70));
      console.log('Units WITHOUT slugs:');
      console.log('='.repeat(70) + '\n');

      unitsWithoutSlug.forEach((unit, index) => {
        console.log(`${index + 1}. "${unit.name}"`);
        console.log(`   ID: ${unit.id}\n`);
      });

      console.log('⚠️  Run migration to generate slugs for these units:');
      console.log('   yarn migrate:slugs:preview  (dry run)');
      console.log('   yarn migrate:slugs          (actual migration)\n');
    }

    console.log('='.repeat(70));
    console.log('Summary:');
    console.log('='.repeat(70));
    console.log(`✅ Units with slugs: ${unitsWithSlug.length}`);
    console.log(`❌ Units without slugs: ${unitsWithoutSlug.length}`);
    console.log(`📊 Total: ${allUnits.length}`);
    console.log('='.repeat(70) + '\n');

    if (unitsWithoutSlug.length === 0) {
      console.log('🎉 All units have slugs!');
    }

  } catch (error) {
    console.error('💥 Error verifying slugs:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
verifyUnitSlugs()
  .catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
