#!/usr/bin/env node

/**
 * Test script for PDF parser
 * Usage: npx tsx test-pdf-parser.ts <path-to-pdf>
 */

import { parsePDFWithPyMuPDF } from './utils/pdf-parser';

async function main() {
  const pdfPath = process.argv[2];

  if (!pdfPath) {
    console.error('❌ Usage: npx tsx test-pdf-parser.ts <path-to-pdf>');
    process.exit(1);
  }

  console.log(`📄 Testing PDF parser on: ${pdfPath}`);
  console.log('⏳ Parsing...\n');

  try {
    const startTime = Date.now();
    const pages = await parsePDFWithPyMuPDF(pdfPath);
    const elapsed = Date.now() - startTime;

    console.log(`✅ Success! Parsed ${pages.length} pages in ${elapsed}ms\n`);
    console.log('📊 Summary:');
    console.log(`   - Total pages: ${pages.length}`);
    console.log(`   - Total characters: ${pages.reduce((sum, p) => sum + p.charCount, 0)}`);
    console.log(`   - Pages with images: ${pages.filter(p => p.hasImages).length}`);
    console.log(`   - Pages with tables: ${pages.filter(p => p.hasTables).length}\n`);

    // Show first page preview
    if (pages.length > 0) {
      const firstPage = pages[0];
      console.log('📄 First page preview:');
      console.log(`   Page ${firstPage.pageNumber}:`);
      console.log(`   - Characters: ${firstPage.charCount}`);
      console.log(`   - Has images: ${firstPage.hasImages}`);
      console.log(`   - Has tables: ${firstPage.hasTables}`);
      console.log(`   - Text preview (first 200 chars):`);
      console.log(`     ${firstPage.text.substring(0, 200)}...\n`);
    }

    // Show all pages summary
    console.log('📋 All pages:');
    pages.forEach((page, idx) => {
      console.log(`   Page ${page.pageNumber}: ${page.charCount} chars, images: ${page.hasImages}, tables: ${page.hasTables}`);
    });

  } catch (error) {
    console.error('❌ Error:', (error as Error).message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

main();

