import { db } from '../../db';
import { websites, pages, trigrams } from '../../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { logWithTimestamp } from '../../utils';

export class TrigramIndexer {
  private static instance: TrigramIndexer;

  private constructor() {
    logWithTimestamp('[TrigramIndexer] Initialized');
  }

  static getInstance(): TrigramIndexer {
    if (!TrigramIndexer.instance) {
      TrigramIndexer.instance = new TrigramIndexer();
    }
    return TrigramIndexer.instance;
  }

  private generateTrigrams(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const trigrams: string[] = [];
    
    for (const word of words) {
      if (word.length < 3) continue;
      for (let i = 0; i <= word.length - 3; i++) {
        trigrams.push(word.slice(i, i + 3));
      }
    }
    
    return [...new Set(trigrams)];
  }

  async indexWebsite(url: string, userId: string) {
    try {
      logWithTimestamp('[TrigramIndexer] Starting website indexing', { url, userId });

      // Create website record
      const websiteId = crypto.randomUUID();
      await db.insert(websites).values({
        id: websiteId,
        url,
        userId,
        lastScanned: new Date(),
        metadata: {}
      });

      logWithTimestamp('[TrigramIndexer] Website record created', { websiteId });

      // For now, just create a single page record
      const pageId = crypto.randomUUID();
      await db.insert(pages).values({
        id: pageId,
        websiteId,
        url,
        content: '',
        lastScanned: new Date()
      });

      logWithTimestamp('[TrigramIndexer] Page record created', { pageId });

      // Generate and store trigrams
      const content = ''; // In a real implementation, this would be the scraped content
      const trigramList = this.generateTrigrams(content);

      for (const trigram of trigramList) {
        await db.insert(trigrams).values({
          id: crypto.randomUUID(),
          trigram,
          pageId,
          frequency: 1
        });
      }

      logWithTimestamp('[TrigramIndexer] Trigrams stored', { count: trigramList.length });

      return {
        websiteId,
        pageCount: 1,
        trigramCount: trigramList.length
      };
    } catch (error) {
      logWithTimestamp('[TrigramIndexer] Error during indexing', { error, url });
      throw error;
    }
  }

  async searchTrigrams(query: string) {
    try {
      logWithTimestamp('[TrigramIndexer] Searching trigrams', { query });

      const queryTrigrams = this.generateTrigrams(query);
      
      const matchingPages = await db
        .select({
          pageId: pages.id,
          url: pages.url,
          title: pages.title,
          description: pages.description
        })
        .from(trigrams)
        .where(inArray(trigrams.trigram, queryTrigrams))
        .innerJoin(pages, eq(pages.id, trigrams.pageId))
        .groupBy(pages.id);

      logWithTimestamp('[TrigramIndexer] Search completed', { 
        queryTrigrams: queryTrigrams.length,
        results: matchingPages.length 
      });

      return matchingPages;
    } catch (error) {
      logWithTimestamp('[TrigramIndexer] Error during search', { error, query });
      throw error;
    }
  }
}

