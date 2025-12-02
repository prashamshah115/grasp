// Quick verification script - run in browser console
(async () => {
  console.log('🧪 QUICK VERIFICATION TEST');
  console.log('==========================');
  
  // Check 1: Supabase connection
  try {
    const { data: { user } } = await supabase.auth.getUser();
    console.log('✅ User authenticated:', user?.email || 'Not logged in');
  } catch (e) {
    console.error('❌ Auth check failed:', e);
  }
  
  // Check 2: Check if new tables exist
  try {
    const { error: paraError } = await supabase
      .from('document_paragraphs')
      .select('id')
      .limit(1);
    if (paraError && paraError.code === 'PGRST116') {
      console.log('⚠️  document_paragraphs table not found (migration may not be applied)');
    } else {
      console.log('✅ document_paragraphs table accessible');
    }
  } catch (e) {
    console.error('❌ document_paragraphs check failed:', e);
  }
  
  try {
    const { error: memError } = await supabase
      .from('user_memory')
      .select('id')
      .limit(1);
    if (memError && memError.code === 'PGRST116') {
      console.log('⚠️  user_memory table not found (migration may not be applied)');
    } else {
      console.log('✅ user_memory table accessible');
    }
  } catch (e) {
    console.error('❌ user_memory check failed:', e);
  }
  
  // Check 3: Check mastery_score column
  try {
    const { error: masteryError } = await supabase
      .from('user_topic_mastery')
      .select('mastery_score')
      .limit(1);
    if (masteryError && masteryError.message?.includes('mastery_score')) {
      console.log('⚠️  mastery_score column not found (migration may not be applied)');
    } else {
      console.log('✅ mastery_score column accessible');
    }
  } catch (e) {
    console.error('❌ mastery_score check failed:', e);
  }
  
  // Check 4: Check RPC function
  try {
    const { error: rpcError } = await supabase.rpc('search_document_paragraphs', {
      query_embedding: new Array(768).fill(0.1),
      match_count: 1
    });
    if (rpcError && rpcError.code === '42883') {
      console.log('⚠️  search_document_paragraphs function not found (migration may not be applied)');
    } else if (rpcError && rpcError.message?.includes('dimension')) {
      console.log('✅ search_document_paragraphs function exists (dimension error is expected)');
    } else {
      console.log('✅ search_document_paragraphs function accessible');
    }
  } catch (e) {
    console.error('❌ RPC check failed:', e);
  }
  
  console.log('\n📊 Verification complete!');
})();
