import { db } from '../../db';
import { feedback, blogPosts } from '../../db/schema';
import { eq, avg, desc } from 'drizzle-orm';
import { logWithTimestamp } from '../../utils';

export class FeedbackCollector {
  async collectFeedback(blogPostId: string, userId: string, rating: number, comment?: string) {
    try {
      logWithTimestamp('[FeedbackCollector] Collecting feedback', { blogPostId, userId, rating });
      
      await db.insert(feedback).values({
        id: crypto.randomUUID(),
        blogPostId,
        userId,
        rating,
        comment,
        createdAt: new Date()
      });

      logWithTimestamp('[FeedbackCollector] Feedback collected successfully');
    } catch (error) {
      logWithTimestamp('[FeedbackCollector] Error collecting feedback', { error, blogPostId });
      throw error;
    }
  }

  async getAverageFeedback(blogPostId: string) {
    try {
      logWithTimestamp('[FeedbackCollector] Getting average feedback', { blogPostId });
      
      const result = await db.select({
        averageRating: avg(feedback.rating)
      })
      .from(feedback)
      .where(eq(feedback.blogPostId, blogPostId));

      logWithTimestamp('[FeedbackCollector] Retrieved average feedback', { result });
      return result[0]?.averageRating ?? 0;
    } catch (error) {
      logWithTimestamp('[FeedbackCollector] Error getting average feedback', { error, blogPostId });
      throw error;
    }
  }
}

