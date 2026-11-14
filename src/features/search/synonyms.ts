/**
 * Curated local synonym groups for smart search (no model, no network). Every word in a
 * group expands to the others as a lower-weight OR term. Single lowercase words only, so
 * each one maps straight onto an FTS5 prefix term. Keep groups tight: a loose group makes
 * every search noisy.
 */
export const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  // Content kinds
  ['pdf', 'paper', 'document', 'doc', 'ebook'],
  ['video', 'youtube', 'clip', 'film', 'movie', 'vlog'],
  ['article', 'post', 'blog', 'story', 'essay', 'writeup'],
  ['note', 'memo', 'jot', 'notes'],
  ['photo', 'image', 'picture', 'pic', 'screenshot'],
  ['podcast', 'episode', 'audio', 'show'],
  ['book', 'novel', 'ebook', 'reading'],
  ['link', 'url', 'website', 'site', 'page', 'webpage'],
  ['highlight', 'quote', 'excerpt', 'snippet'],
  ['thread', 'tweet', 'toot', 'post'],
  ['newsletter', 'digest', 'email'],
  ['slides', 'deck', 'presentation', 'talk', 'keynote'],
  ['course', 'class', 'lesson', 'lecture', 'tutorial'],
  ['guide', 'howto', 'tutorial', 'walkthrough', 'manual'],
  ['docs', 'documentation', 'reference', 'manual', 'api'],
  ['review', 'critique', 'opinion'],
  ['interview', 'conversation', 'qa'],
  ['research', 'study', 'paper', 'thesis', 'journal'],
  ['news', 'headline', 'report'],
  ['list', 'checklist', 'todo', 'tasks'],
  ['template', 'boilerplate', 'starter'],
  ['tool', 'app', 'utility', 'software'],
  ['library', 'package', 'module', 'framework'],
  ['repo', 'repository', 'github', 'source'],
  ['map', 'location', 'place', 'directions'],
  ['chart', 'graph', 'plot', 'diagram', 'visualization'],

  // Food & home
  ['recipe', 'cooking', 'food', 'dish', 'meal', 'cook'],
  ['baking', 'bread', 'cake', 'pastry', 'dessert'],
  ['restaurant', 'cafe', 'eatery', 'dining', 'bistro'],
  ['coffee', 'espresso', 'latte', 'brew'],
  ['drink', 'cocktail', 'beverage', 'wine', 'beer'],
  ['vegan', 'vegetarian', 'plantbased'],
  ['home', 'house', 'apartment', 'interior'],
  ['garden', 'gardening', 'plants', 'plant'],
  ['diy', 'craft', 'handmade', 'project'],
  ['clean', 'cleaning', 'tidy', 'declutter'],

  // Tech
  ['code', 'programming', 'dev', 'coding', 'software', 'developer'],
  ['javascript', 'js', 'typescript', 'ts', 'node'],
  ['react', 'reactnative', 'expo', 'jsx'],
  ['python', 'py', 'django', 'pandas'],
  ['android', 'kotlin', 'compose', 'jetpack'],
  ['ios', 'swift', 'swiftui', 'iphone'],
  ['css', 'style', 'stylesheet', 'tailwind'],
  ['database', 'db', 'sql', 'sqlite', 'postgres'],
  ['api', 'endpoint', 'rest', 'graphql'],
  ['bug', 'error', 'issue', 'crash', 'fix'],
  ['test', 'testing', 'jest', 'spec', 'qa'],
  ['deploy', 'deployment', 'release', 'ship', 'hosting'],
  ['server', 'backend', 'infra', 'infrastructure'],
  ['frontend', 'web', 'browser', 'html'],
  ['ai', 'ml', 'llm', 'gpt', 'neural'],
  ['security', 'privacy', 'encryption', 'auth'],
  ['performance', 'speed', 'fast', 'optimization', 'perf'],
  ['linux', 'unix', 'terminal', 'shell', 'cli', 'bash'],
  ['git', 'github', 'gitlab', 'commit', 'branch'],
  ['algorithm', 'algorithms', 'datastructures', 'leetcode'],
  ['game', 'gaming', 'videogame', 'games'],
  ['hardware', 'gadget', 'device', 'electronics'],
  ['phone', 'mobile', 'smartphone', 'android', 'iphone'],
  ['laptop', 'computer', 'pc', 'mac', 'desktop'],

  // Design & creative
  ['design', 'ui', 'ux', 'interface', 'layout'],
  ['font', 'typeface', 'typography', 'type'],
  ['color', 'colour', 'palette', 'colors'],
  ['icon', 'icons', 'glyph', 'symbol'],
  ['animation', 'motion', 'transition', 'animate'],
  ['logo', 'brand', 'branding', 'identity'],
  ['illustration', 'drawing', 'art', 'sketch'],
  ['photography', 'camera', 'lens', 'photo'],
  ['music', 'song', 'album', 'playlist', 'track'],
  ['inspiration', 'ideas', 'moodboard', 'inspo'],
  ['writing', 'writer', 'author', 'prose'],

  // Work & money
  ['work', 'job', 'career', 'office'],
  ['job', 'hiring', 'resume', 'cv', 'interview'],
  ['meeting', 'call', 'agenda', 'standup'],
  ['productivity', 'workflow', 'efficiency', 'focus'],
  ['startup', 'company', 'business', 'founder'],
  ['marketing', 'seo', 'ads', 'growth'],
  ['money', 'finance', 'budget', 'savings', 'investing'],
  ['invest', 'investing', 'stocks', 'portfolio'],
  ['tax', 'taxes', 'invoice', 'receipt'],
  ['shopping', 'buy', 'purchase', 'store', 'shop', 'deal'],
  ['gift', 'present', 'wishlist'],
  ['price', 'cost', 'cheap', 'deal'],
  ['plan', 'planning', 'roadmap', 'strategy'],
  ['idea', 'ideas', 'brainstorm', 'concept'],

  // Life
  ['travel', 'trip', 'vacation', 'holiday', 'journey'],
  ['flight', 'airline', 'airport', 'plane'],
  ['hotel', 'stay', 'airbnb', 'hostel', 'lodging'],
  ['health', 'medical', 'doctor', 'wellness'],
  ['fitness', 'workout', 'exercise', 'gym', 'training'],
  ['run', 'running', 'jog', 'marathon'],
  ['yoga', 'meditation', 'mindfulness', 'breathing'],
  ['sleep', 'rest', 'insomnia', 'nap'],
  ['diet', 'nutrition', 'calories', 'protein'],
  ['mental', 'anxiety', 'stress', 'therapy'],
  ['kids', 'children', 'parenting', 'family', 'baby'],
  ['pet', 'dog', 'cat', 'puppy', 'kitten'],
  ['car', 'auto', 'vehicle', 'driving'],
  ['bike', 'bicycle', 'cycling'],
  ['learn', 'learning', 'education', 'study', 'school'],
  ['language', 'vocabulary', 'grammar', 'translate'],
  ['history', 'historical', 'past', 'archive'],
  ['science', 'physics', 'chemistry', 'biology'],
  ['space', 'astronomy', 'nasa', 'planet', 'rocket'],
  ['climate', 'environment', 'sustainability', 'green'],
  ['politics', 'election', 'government', 'policy'],
  ['sport', 'sports', 'football', 'soccer', 'cricket', 'basketball'],
  ['event', 'conference', 'meetup', 'festival'],
  ['weather', 'forecast', 'rain', 'temperature'],
  ['event', 'calendar', 'schedule', 'date'],
  ['friend', 'friends', 'social', 'community'],
  ['how', 'howto', 'guide', 'tips'],
  ['tips', 'tricks', 'hacks', 'advice'],
  ['free', 'opensource', 'oss', 'gratis'],
  ['funny', 'humor', 'meme', 'joke'],
];

/** word → every other word that shares a group with it (built once, on first import). */
export const SYNONYMS: ReadonlyMap<string, readonly string[]> = (() => {
  const map = new Map<string, Set<string>>();
  for (const group of SYNONYM_GROUPS) {
    for (const word of group) {
      const set = map.get(word) ?? new Set<string>();
      for (const other of group) if (other !== word) set.add(other);
      map.set(word, set);
    }
  }
  return new Map([...map].map(([k, v]) => [k, [...v]]));
})();
