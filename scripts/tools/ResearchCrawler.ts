import * as cheerio from 'cheerio';
import { MemoryVectorStore } from './MemoryVectorStore';
import { EmbeddingsGenerator } from './EmbeddingsGenerator';
import { ollama } from "ollama-ai-provider";
import { streamText } from "ai";

interface ResearchResult {
  url: string;
  title: string;
  summary: string;
  relevance: number;
  quotes: string[];
  statistics: string[];
  sourceAuthority: number;
  timestamp: string;
  domain: string;
  category: 'academic' | 'news' | 'blog' | 'documentation' | 'research' | 'other';
}

interface TopicInsight {
  mainTopics: string[];
  relatedTopics: string[];
  keyFindings: string[];
  sources: ResearchResult[];
  trendAnalysis: {
    emerging: string[];
    established: string[];
    declining: string[];
  };
  statistics: {
    category: string;
    value: string;
    source: string;
  }[];
  expertQuotes: {
    quote: string;
    author: string;
    source: string;
  }[];
}

interface BlogPostSection {
  heading: string;
  content: string;
  wordCount: number;
  sources: string[];
  keywords: string[];
}

interface BlogPost {
  title: string;
  description: string;
  sections: BlogPostSection[];
  totalWordCount: number;
  sources: {
    url: string;
    title: string;
    authority: number;
  }[];
  keywords: {
    primary: string[];
    secondary: string[];
  };
  seoScore: number;
  iteration: number;
}

interface BlogPostRequirements {
  targetWordCount: number;
  minSections: number;
  keywordsPerSection: number;
  sourcesPerSection: number;
  style: 'academic' | 'conversational' | 'technical' | 'professional';
  tone: 'formal' | 'informal' | 'balanced';
  audience: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

export class ResearchCrawler {
  private vectorStore: MemoryVectorStore;
  private embeddings: EmbeddingsGenerator;
  private seenUrls = new Set<string>();
  private maxDepth = 3;
  private maxUrlsPerDomain = 5;
  private bingSearchKey: string;
  private domainCounts: Map<string, number> = new Map();
  private model: ReturnType<typeof ollama>;

  constructor(bingSearchKey?: string) {
    this.vectorStore = new MemoryVectorStore();
    this.embeddings = new EmbeddingsGenerator();
    this.bingSearchKey = bingSearchKey || process.env.BING_SEARCH_KEY || '';
    this.model = ollama("llama3-gradient");
  }

  async researchTopic(topic: string, seedUrls: string[] = []): Promise<TopicInsight> {
    console.log(`Starting comprehensive research on: ${topic}`);
    
    const results: ResearchResult[] = [];
    const mainTopics = new Set<string>();
    const relatedTopics = new Set<string>();
    
    // Get URLs from multiple sources
    const researchUrls = await this.gatherResearchUrls(topic, seedUrls);
    
    // Crawl each URL and gather data
    for (const url of researchUrls) {
      if (this.seenUrls.has(url)) continue;
      
      const domain = new URL(url).hostname;
      const domainCount = this.domainCounts.get(domain) || 0;
      if (domainCount >= this.maxUrlsPerDomain) continue;
      
      try {
        const pageData = await this.crawlPage(url, topic);
        if (pageData && pageData.relevance > 0.6) { // Only keep relevant content
          results.push(pageData);
          this.domainCounts.set(domain, domainCount + 1);
          
          const topics = await this.extractTopics(pageData.summary);
          topics.main.forEach(t => mainTopics.add(t));
          topics.related.forEach(t => relatedTopics.add(t));
          
          await this.vectorStore.storeVectors(
            topic,
            [pageData.summary, ...pageData.quotes]
          );
        }
      } catch (error) {
        console.error(`Error crawling ${url}:`, error);
      }
    }

    const trendAnalysis = await this.analyzeTrends(
      Array.from(mainTopics),
      Array.from(relatedTopics),
      results
    );

    return {
      mainTopics: Array.from(mainTopics),
      relatedTopics: Array.from(relatedTopics),
      keyFindings: await this.extractKeyFindings(results),
      sources: results,
      trendAnalysis,
      statistics: await this.extractAllStatistics(results),
      expertQuotes: await this.extractExpertQuotes(results)
    };
  }

  private async gatherResearchUrls(topic: string, seedUrls: string[]): Promise<string[]> {
    const urls = new Set<string>(seedUrls);
    
    // Add Bing search results if API key is available
    if (this.bingSearchKey) {
      const bingUrls = await this.searchBing(topic);
      bingUrls.forEach(url => urls.add(url));
    }
    
    // Add URLs from known authoritative sources
    const queries = [
      topic,
      `${topic} research`,
      `${topic} statistics`,
      `${topic} case study`,
      `${topic} analysis`
    ];

    const sources = {
      academic: [
        'scholar.google.com',
        'researchgate.net',
        'academia.edu',
        'arxiv.org',
        'sciencedirect.com'
      ],
      news: [
        'reuters.com',
        'bloomberg.com',
        'ft.com',
        'wsj.com',
        'nytimes.com'
      ],
      tech: [
        'github.com',
        'stackoverflow.com',
        'dev.to',
        'medium.com',
        'hashnode.com'
      ],
      research: [
        'statista.com',
        'pewresearch.org',
        'who.int',
        'worldbank.org',
        'gartner.com'
      ],
      documentation: [
        'docs.microsoft.com',
        'developer.mozilla.org',
        'developers.google.com',
        'docs.aws.amazon.com',
        'learn.microsoft.com'
      ]
    };

    // Add source-specific search URLs
    for (const [category, domains] of Object.entries(sources)) {
      for (const domain of domains) {
        for (const query of queries) {
          urls.add(`https://${domain}/search?q=${encodeURIComponent(query)}`);
        }
      }
    }

    return Array.from(urls);
  }

  private async searchBing(query: string): Promise<string[]> {
    try {
      const response = await fetch(
        `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=50`,
        {
          headers: {
            'Ocp-Apim-Subscription-Key': this.bingSearchKey
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Bing search failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.webPages.value.map((result: any) => result.url);
    } catch (error) {
      console.error('Bing search error:', error);
      return [];
    }
  }

  private async crawlPage(url: string, topic: string): Promise<ResearchResult | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ResearchBot/1.0; +http://example.com/bot)'
        }
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const html = await response.text();
      const $ = cheerio.load(html);

      const domain = new URL(url).hostname;
      const title = $('title').text().trim();
      const mainContent = this.extractMainContent($);
      const quotes = this.extractQuotes($);
      const statistics = this.extractStatistics($);
      
      const sourceAuthority = this.calculateSourceAuthority(url);
      const relevance = await this.calculateRelevance(mainContent, topic);
      const category = this.determineCategory(domain);

      return {
        url,
        title,
        summary: this.generateSummary(mainContent),
        relevance,
        quotes,
        statistics,
        sourceAuthority,
        timestamp: new Date().toISOString(),
        domain,
        category
      };
    } catch (error) {
      console.error(`Error crawling ${url}:`, error);
      return null;
    }
  }

  private extractMainContent($: cheerio.CheerioAPI): string {
    // Try multiple selectors for main content
    const contentSelectors = [
      'article',
      'main',
      '[role="main"]',
      '.content',
      '#content',
      '.post-content',
      '.article-content',
      '.entry-content'
    ];

    for (const selector of contentSelectors) {
      const content = $(selector).text().trim();
      if (content.length > 100) return content;
    }

    // Fallback: get all paragraph text
    return $('p').map((_, el) => $(el).text().trim()).get().join('\n\n');
  }

  private extractQuotes($: cheerio.CheerioAPI): string[] {
    const quotes: string[] = [];
    
    // Extract from quote elements
    $('blockquote, q, cite, .quote').each((_, el) => {
      const quote = $(el).text().trim();
      if (quote.length > 0) quotes.push(quote);
    });

    // Look for quoted text in paragraphs
    $('p').each((_, el) => {
      const text = $(el).text();
      const matches = text.match(/"([^"]{20,500})"/g);
      if (matches) quotes.push(...matches);
    });

    return [...new Set(quotes)];
  }

  private extractStatistics($: cheerio.CheerioAPI): string[] {
    const stats: string[] = [];
    
    // Look for numbers with context
    $('p, li, td').each((_, el) => {
      const text = $(el).text();
      const matches = text.match(/\d+(\.\d+)?%|\d+ (million|billion|trillion)|[\d,]+ (people|users|customers|dollars|USD)/g);
      if (matches) stats.push(...matches);
    });

    return [...new Set(stats)];
  }

  private determineCategory(domain: string): ResearchResult['category'] {
    const patterns = {
      academic: /(edu|academia|research|scholar)/,
      news: /(news|reuters|bloomberg|bbc|cnn)/,
      documentation: /(docs|developer|api|sdk)/,
      research: /(research|study|survey|report)/,
      blog: /(blog|medium|dev.to|hashnode)/
    };

    for (const [category, pattern] of Object.entries(patterns)) {
      if (pattern.test(domain)) {
        return category as ResearchResult['category'];
      }
    }

    return 'other';
  }

  private calculateSourceAuthority(url: string): number {
    const authorityScores: { [domain: string]: number } = {
      // Academic
      'scholar.google.com': 0.95,
      'researchgate.net': 0.9,
      'academia.edu': 0.85,
      'arxiv.org': 0.9,
      'sciencedirect.com': 0.9,
      
      // News
      'reuters.com': 0.9,
      'bloomberg.com': 0.85,
      'ft.com': 0.85,
      'wsj.com': 0.85,
      'nytimes.com': 0.85,
      
      // Tech
      'github.com': 0.8,
      'stackoverflow.com': 0.8,
      'dev.to': 0.7,
      'medium.com': 0.7,
      
      // Research
      'statista.com': 0.9,
      'pewresearch.org': 0.9,
      'who.int': 0.95,
      'worldbank.org': 0.95,
      
      // Documentation
      'docs.microsoft.com': 0.85,
      'developer.mozilla.org': 0.85,
      'developers.google.com': 0.85,
      'docs.aws.amazon.com': 0.85
    };
    
    const domain = new URL(url).hostname;
    return authorityScores[domain] || 0.5;
  }

  private async calculateRelevance(content: string, topic: string): Promise<number> {
    const [contentEmbedding, topicEmbedding] = await Promise.all([
      this.embeddings.generateEmbeddings(content),
      this.embeddings.generateEmbeddings(topic)
    ]);
    
    return this.cosineSimilarity(contentEmbedding, topicEmbedding);
  }

  private generateSummary(content: string): string {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const importantSentences = sentences
      .filter(s => {
        const lower = s.toLowerCase();
        return (
          lower.includes('research') ||
          lower.includes('study') ||
          lower.includes('found') ||
          lower.includes('according') ||
          lower.includes('shows') ||
          lower.includes('demonstrates') ||
          /\d+%/.test(lower)
        );
      })
      .slice(0, 5);

    return importantSentences.join('. ') + '.';
  }

  private async extractTopics(content: string): Promise<{ main: string[], related: string[] }> {
    const words = content.toLowerCase().split(/\W+/);
    const significantWords = words.filter(w => 
      w.length > 4 && 
      !['which', 'there', 'their', 'about', 'would'].includes(w)
    );
    
    // Use frequency to determine importance
    const wordFreq = new Map<string, number>();
    significantWords.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });

    const sortedWords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1]);

    return {
      main: sortedWords.slice(0, 5).map(([word]) => word),
      related: sortedWords.slice(5, 15).map(([word]) => word)
    };
  }

  private async extractKeyFindings(results: ResearchResult[]): Promise<string[]> {
    const findings = new Set<string>();
    
    results
      .filter(result => result.relevance > 0.7)
      .sort((a, b) => b.sourceAuthority - a.sourceAuthority)
      .forEach(result => {
        result.quotes
          .filter(quote => quote.length > 50 && quote.length < 300)
          .forEach(quote => findings.add(quote));
        
        result.statistics.forEach(stat => findings.add(stat));
      });
    
    return Array.from(findings)
      .sort((a, b) => b.length - a.length)
      .slice(0, 15);
  }

  private async extractAllStatistics(results: ResearchResult[]): Promise<TopicInsight['statistics']> {
    const stats: TopicInsight['statistics'] = [];
    
    results.forEach(result => {
      result.statistics.forEach(stat => {
        stats.push({
          category: this.categorizeStatistic(stat),
          value: stat,
          source: result.domain
        });
      });
    });

    return stats;
  }

  private categorizeStatistic(stat: string): string {
    if (stat.includes('%')) return 'percentage';
    if (stat.includes('million') || stat.includes('billion')) return 'volume';
    if (stat.includes('people') || stat.includes('users')) return 'demographic';
    if (stat.includes('dollars') || stat.includes('USD')) return 'financial';
    return 'general';
  }

  private async extractExpertQuotes(results: ResearchResult[]): Promise<TopicInsight['expertQuotes']> {
    const quotes: TopicInsight['expertQuotes'] = [];
    
    results
      .filter(result => result.sourceAuthority > 0.8)
      .forEach(result => {
        result.quotes
          .filter(quote => quote.length > 50 && quote.length < 300)
          .forEach(quote => {
            quotes.push({
              quote,
              author: 'Expert', // In a real implementation, we'd extract author names
              source: result.domain
            });
          });
      });

    return quotes;
  }

  private async analyzeTrends(
    mainTopics: string[],
    relatedTopics: string[],
    results: ResearchResult[]
  ): Promise<TopicInsight['trendAnalysis']> {
    const topicMentions = new Map<string, { count: number, timestamps: Date[] }>();
    
    [...mainTopics, ...relatedTopics].forEach(topic => {
      topicMentions.set(topic, { count: 0, timestamps: [] });
    });
    
    results.forEach(result => {
      const timestamp = new Date(result.timestamp);
      topicMentions.forEach((data, topic) => {
        if (result.summary.toLowerCase().includes(topic.toLowerCase())) {
          data.count++;
          data.timestamps.push(timestamp);
        }
      });
    });
    
    const emerging: string[] = [];
    const established: string[] = [];
    const declining: string[] = [];
    
    topicMentions.forEach((data, topic) => {
      if (data.count > 5) {
        established.push(topic);
      } else if (data.timestamps.some(t => t > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))) {
        emerging.push(topic);
      } else {
        declining.push(topic);
      }
    });
    
    return { emerging, established, declining };
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  async generateBlogPost(
    topic: string,
    requirements: BlogPostRequirements,
    existingPost?: BlogPost
  ): Promise<BlogPost> {
    // First, gather research if not already done
    const research = await this.researchTopic(topic, []);
    
    // Initialize blog post structure
    const iteration = existingPost ? existingPost.iteration + 1 : 1;
    let post: BlogPost = {
      title: "",
      description: "",
      sections: [],
      totalWordCount: 0,
      sources: [],
      keywords: { primary: [], secondary: [] },
      seoScore: 0,
      iteration
    };

    // Generate or update the post in chunks to handle any word count
    while (post.totalWordCount < requirements.targetWordCount) {
      const remainingWords = requirements.targetWordCount - post.totalWordCount;
      await this.expandBlogPost(post, research, requirements, remainingWords);
    }

    // Optimize the post
    post = await this.optimizeBlogPost(post, research, requirements);

    return post;
  }

  private async expandBlogPost(
    post: BlogPost,
    research: TopicInsight,
    requirements: BlogPostRequirements,
    remainingWords: number
  ): Promise<void> {
    // Calculate how many sections we need
    const targetWordsPerSection = Math.ceil(remainingWords / Math.max(requirements.minSections, 3));
    
    // Generate or update title and description if needed
    if (!post.title || !post.description) {
      const titleDesc = await this.generateTitleAndDescription(research, requirements);
      post.title = titleDesc.title;
      post.description = titleDesc.description;
    }

    // Generate new sections or update existing ones
    const sectionTopics = await this.generateSectionTopics(research, requirements);
    
    for (const topic of sectionTopics) {
      const section = await this.generateSection(
        topic,
        research,
        requirements,
        targetWordsPerSection
      );
      post.sections.push(section);
      post.totalWordCount += section.wordCount;

      if (post.totalWordCount >= requirements.targetWordCount) break;
    }
  }

  private async generateSection(
    topic: string,
    research: TopicInsight,
    requirements: BlogPostRequirements,
    targetWords: number
  ): Promise<BlogPostSection> {
    // Find relevant research data
    const relevantQuotes = research.expertQuotes
      .filter(q => this.isRelevantToTopic(q.quote, topic))
      .slice(0, requirements.sourcesPerSection);
    
    const relevantStats = research.statistics
      .filter(s => this.isRelevantToTopic(s.value, topic))
      .slice(0, requirements.sourcesPerSection);

    // Generate section content using AI
    const prompt = this.createSectionPrompt(
      topic,
      relevantQuotes,
      relevantStats,
      requirements,
      targetWords
    );

    const content = await this.generateContent(prompt, targetWords);
    
    return {
      heading: topic,
      content,
      wordCount: content.split(/\s+/).length,
      sources: [...new Set([
        ...relevantQuotes.map(q => q.source),
        ...relevantStats.map(s => s.source)
      ])],
      keywords: await this.extractKeywords(content, requirements.keywordsPerSection)
    };
  }

  private async generateContent(prompt: string, targetWords: number): Promise<string> {
    let content = "";
    const maxTokensPerChunk = 1000; // Adjust based on model's context window
    
    while (content.split(/\s+/).length < targetWords) {
      const remainingWords = targetWords - content.split(/\s+/).length;
      
      const result = await streamText({
        model: this.model,
        system: `You are an expert content writer. Generate natural, engaging content that flows well with the existing text. Target word count: ${remainingWords}`,
        messages: [
          {
            role: "user",
            content: prompt + (content ? `\nExisting content: ${content}\nContinue from here, maintaining the same style and tone.` : "")
          }
        ],
        maxTokens: maxTokensPerChunk
      });

      let chunkContent = "";
      for await (const chunk of result.textStream) {
        chunkContent += chunk;
      }

      content += (content ? " " : "") + chunkContent;
    }

    return content;
  }

  private async optimizeBlogPost(
    post: BlogPost,
    research: TopicInsight,
    requirements: BlogPostRequirements
  ): Promise<BlogPost> {
    // Optimize each section
    const optimizedSections = await Promise.all(
      post.sections.map(async section => {
        const optimizedContent = await this.optimizeSection(
          section,
          research,
          requirements
        );
        return { ...section, ...optimizedContent };
      })
    );

    // Update post with optimized sections
    post.sections = optimizedSections;
    post.totalWordCount = optimizedSections.reduce((sum, s) => sum + s.wordCount, 0);

    // Extract and optimize keywords
    post.keywords = await this.optimizeKeywords(
      optimizedSections.flatMap(s => s.keywords),
      research
    );

    // Calculate SEO score
    post.seoScore = this.calculateSEOScore(post, requirements);

    return post;
  }

  private async optimizeSection(
    section: BlogPostSection,
    research: TopicInsight,
    requirements: BlogPostRequirements
  ): Promise<Partial<BlogPostSection>> {
    const prompt = `
      Optimize this content section for ${requirements.style} style and ${requirements.tone} tone.
      Target audience: ${requirements.audience}
      Current content: ${section.content}
      
      Improve:
      1. Clarity and flow
      2. Use of evidence and citations
      3. Engagement and readability
      4. Technical accuracy
      
      Maintain the same key points and information while making it more engaging and authoritative.
    `;

    const optimizedContent = await this.generateContent(
      prompt,
      section.content.split(/\s+/).length
    );

    return {
      content: optimizedContent,
      wordCount: optimizedContent.split(/\s+/).length,
      keywords: await this.extractKeywords(optimizedContent, requirements.keywordsPerSection)
    };
  }

  private async generateTitleAndDescription(
    research: TopicInsight,
    requirements: BlogPostRequirements
  ): Promise<{ title: string; description: string }> {
    const prompt = `
      Generate an engaging title and meta description for a ${requirements.style} blog post.
      Target audience: ${requirements.audience}
      Main topics: ${research.mainTopics.join(", ")}
      Key findings: ${research.keyFindings.slice(0, 3).join(" ")}
    `;

    const result = await streamText({
      model: this.model,
      messages: [{ role: "user", content: prompt }]
    });

    let response = "";
    for await (const chunk of result.textStream) {
      response += chunk;
    }

    const [title, description] = response.split("\n");
    return {
      title: title.replace(/^Title:\s*/i, ""),
      description: description.replace(/^Description:\s*/i, "")
    };
  }

  private async generateSectionTopics(
    research: TopicInsight,
    requirements: BlogPostRequirements
  ): Promise<string[]> {
    // Combine main topics and key findings to generate section topics
    const prompt = `
      Generate ${requirements.minSections} section headings for a ${requirements.style} blog post.
      Target audience: ${requirements.audience}
      Main topics: ${research.mainTopics.join(", ")}
      Key findings: ${research.keyFindings.join(" ")}
    `;

    const result = await streamText({
      model: this.model,
      messages: [{ role: "user", content: prompt }]
    });

    let response = "";
    for await (const chunk of result.textStream) {
      response += chunk;
    }

    return response.split("\n")
      .map(line => line.replace(/^\d+\.\s*/, "").trim())
      .filter(line => line.length > 0);
  }

  private async extractKeywords(content: string, count: number): Promise<string[]> {
    const words = content.toLowerCase().split(/\W+/);
    const wordFreq = new Map<string, number>();
    
    words.forEach(word => {
      if (word.length > 4) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    });

    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([word]) => word);
  }

  private async optimizeKeywords(
    allKeywords: string[],
    research: TopicInsight
  ): Promise<BlogPost['keywords']> {
    const keywordFreq = new Map<string, number>();
    allKeywords.forEach(word => {
      keywordFreq.set(word, (keywordFreq.get(word) || 0) + 1);
    });

    const sortedKeywords = Array.from(keywordFreq.entries())
      .sort((a, b) => b[1] - a[1]);

    return {
      primary: sortedKeywords.slice(0, 5).map(([word]) => word),
      secondary: sortedKeywords.slice(5, 15).map(([word]) => word)
    };
  }

  private calculateSEOScore(post: BlogPost, requirements: BlogPostRequirements): number {
    let score = 0;
    
    // Title optimization (20 points)
    if (post.title.length >= 40 && post.title.length <= 60) score += 20;
    else if (post.title.length >= 30) score += 10;
    
    // Description optimization (20 points)
    if (post.description.length >= 120 && post.description.length <= 155) score += 20;
    else if (post.description.length >= 100) score += 10;
    
    // Keyword usage (20 points)
    const keywordDensity = this.calculateKeywordDensity(post);
    if (keywordDensity >= 1 && keywordDensity <= 3) score += 20;
    else if (keywordDensity > 0) score += 10;
    
    // Content length (20 points)
    if (post.totalWordCount >= requirements.targetWordCount) score += 20;
    else if (post.totalWordCount >= requirements.targetWordCount * 0.8) score += 10;
    
    // Source authority (20 points)
    const avgAuthority = post.sources.reduce((sum, s) => sum + s.authority, 0) / post.sources.length;
    score += Math.round(avgAuthority * 20);
    
    return score;
  }

  private calculateKeywordDensity(post: BlogPost): number {
    const content = post.sections.map(s => s.content).join(" ");
    const words = content.toLowerCase().split(/\s+/);
    const keywordCount = post.keywords.primary.reduce((sum, keyword) => {
      return sum + words.filter(w => w === keyword).length;
    }, 0);
    
    return (keywordCount / words.length) * 100;
  }

  private isRelevantToTopic(text: string, topic: string): boolean {
    const normalizedText = text.toLowerCase();
    const normalizedTopic = topic.toLowerCase();
    const topicWords = normalizedTopic.split(/\s+/);
    
    return topicWords.some(word => normalizedText.includes(word));
  }

  private createSectionPrompt(
    topic: string,
    quotes: TopicInsight['expertQuotes'],
    statistics: TopicInsight['statistics'],
    requirements: BlogPostRequirements,
    targetWords: number
  ): string {
    return `
      Write a ${requirements.style} section about "${topic}" for a ${requirements.audience} audience.
      Use a ${requirements.tone} tone.
      Target word count: ${targetWords}

      Include these expert quotes:
      ${quotes.map(q => `"${q.quote}" - ${q.source}`).join('\n')}

      Include these statistics:
      ${statistics.map(s => `${s.value} (${s.source})`).join('\n')}

      Requirements:
      1. Write naturally and engagingly
      2. Integrate quotes and statistics smoothly
      3. Use proper citations
      4. Maintain consistent style and tone
      5. Focus on accuracy and clarity
      6. Target the specified word count
      7. Make it SEO-friendly
      
      Format the content in a way that flows naturally and keeps the reader engaged.
    `;
  }
} 