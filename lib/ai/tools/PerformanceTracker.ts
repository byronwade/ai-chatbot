import { db } from '../../db';
import { blogPosts } from '../../db/schema';
import { eq, avg, desc } from 'drizzle-orm';
import { logWithTimestamp } from '../../utils';

export class PerformanceTracker {
  async trackPerformance(blogPostId: string, performance: number) {
    try {
      logWithTimestamp('[PerformanceTracker] Tracking performance', { blogPostId, performance });
      
      await db.update(blogPosts)
        .set({ performance })
        .where(eq(blogPosts.id, blogPostId));

      logWithTimestamp('[PerformanceTracker] Performance tracked successfully');
    } catch (error) {
      logWithTimestamp('[PerformanceTracker] Error tracking performance', { error, blogPostId });
      throw error;
    }
  }

  async getTopPerformingPosts(limit: number = 5) {
    try {
      logWithTimestamp('[PerformanceTracker] Getting top performing posts', { limit });
      
      const posts = await db.select({
        id: blogPosts.id,
        title: blogPosts.title,
        topic: blogPosts.topic,
        performance: blogPosts.performance
      })
      .from(blogPosts)
      .orderBy(desc(blogPosts.performance))
      .limit(limit);

      logWithTimestamp('[PerformanceTracker] Retrieved top performing posts', { count: posts.length });
      return posts;
    } catch (error) {
      logWithTimestamp('[PerformanceTracker] Error getting top performing posts', { error });
      throw error;
    }
  }

  async getAveragePerformanceByTopic(topic: string) {
    try {
      logWithTimestamp('[PerformanceTracker] Getting average performance by topic', { topic });
      
      const result = await db.select({
        averagePerformance: avg(blogPosts.performance)
      })
      .from(blogPosts)
      .where(eq(blogPosts.topic, topic));

      logWithTimestamp('[PerformanceTracker] Retrieved average performance', { topic, result });
      return result[0]?.averagePerformance ?? 0;
    } catch (error) {
      logWithTimestamp('[PerformanceTracker] Error getting average performance', { error, topic });
      throw error;
    }
  }
}

