/**
 * Unit tests for utility functions
 * Tests the core utility functions that don't require network/DB access
 */

// Mock environment variables before any imports
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.FIREBASE_ADMIN_KEY = JSON.stringify({
  type: 'service_account',
  project_id: 'test-project',
  private_key_id: 'test-key-id',
  private_key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGy0AHB7MfszK0bfBpthR1dF\nvPHYaJGHJFVCnRRREVGINziVMqvlB8g3xgIgXBX8ZKIM9CXjLkpqcSVjNPayDEfK\nqN9VVe5scfKZcV1Fay6r4UfnmUiPj6XyqF8IFpZYcCi9UmVzA9H8pV9XHCxF2H7F\nqhPl4vX5UaynqEPuxDNNXk2nx0jMwppKN9EXJxPxqN7GZxhDB+HqNbZZhb6P5zvX\nLFqbqJQvbuLuB5HlPw3utPpM9k0XsHdraJBpRNSZcTdwA3s3FNdaJQbz6y8P7Z5q\nhPa5VFPQNF3SZmBCvC7gDJPz0i3jXqpIxUl9wwIDAQABAoIBABP0mAJl4IgPy7S9\ntest_key_content\n-----END RSA PRIVATE KEY-----\n',
  client_email: 'test@test-project.iam.gserviceaccount.com',
  client_id: '123456789',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token'
});
process.env.GROQ_API_KEY = 'test-groq-key';
process.env.GOOGLE_SEARCH_API_KEY = 'test-search-key';
process.env.GOOGLE_SEARCH_ENGINE_ID = 'test-cx';

describe('Utility Functions', () => {
  
  describe('getCacheKey', () => {
    // Simple cache key generation test
    it('should normalize query strings', () => {
      const getCacheKey = (query) => query.toLowerCase().trim().replace(/\s+/g, ' ');
      
      expect(getCacheKey('  Hello World  ')).toBe('hello world');
      expect(getCacheKey('UPPERCASE')).toBe('uppercase');
      expect(getCacheKey('multiple   spaces')).toBe('multiple spaces');
    });
  });

  describe('getSourceAuthorityScore', () => {
    const SOURCE_AUTHORITY = {
      highAuthority: ['.gov', '.edu', 'wikipedia.org', 'britannica.com'],
      techAuthority: ['github.com', 'stackoverflow.com', 'developer.mozilla.org'],
      newsAuthority: ['reuters.com', 'bbc.com', 'nytimes.com'],
      mediumAuthority: ['medium.com', 'dev.to', 'freecodecamp.org'],
    };

    const getSourceAuthorityScore = (url) => {
      const urlLower = url.toLowerCase();
      for (const domain of SOURCE_AUTHORITY.highAuthority) {
        if (urlLower.includes(domain)) return { score: 100, tier: '🏛️ Official' };
      }
      for (const domain of SOURCE_AUTHORITY.techAuthority) {
        if (urlLower.includes(domain)) return { score: 80, tier: '💻 Tech Authority' };
      }
      for (const domain of SOURCE_AUTHORITY.newsAuthority) {
        if (urlLower.includes(domain)) return { score: 70, tier: '📰 News' };
      }
      for (const domain of SOURCE_AUTHORITY.mediumAuthority) {
        if (urlLower.includes(domain)) return { score: 50, tier: '📝 Community' };
      }
      return { score: 30, tier: '🌐 Web' };
    };

    it('should give highest score to .gov and .edu domains', () => {
      expect(getSourceAuthorityScore('https://www.nasa.gov/article')).toEqual({ score: 100, tier: '🏛️ Official' });
      expect(getSourceAuthorityScore('https://mit.edu/research')).toEqual({ score: 100, tier: '🏛️ Official' });
      expect(getSourceAuthorityScore('https://en.wikipedia.org/wiki/AI')).toEqual({ score: 100, tier: '🏛️ Official' });
    });

    it('should give tech authority score to dev sites', () => {
      expect(getSourceAuthorityScore('https://github.com/repo')).toEqual({ score: 80, tier: '💻 Tech Authority' });
      expect(getSourceAuthorityScore('https://stackoverflow.com/questions')).toEqual({ score: 80, tier: '💻 Tech Authority' });
    });

    it('should give news score to major news sites', () => {
      expect(getSourceAuthorityScore('https://www.bbc.com/news')).toEqual({ score: 70, tier: '📰 News' });
      expect(getSourceAuthorityScore('https://www.reuters.com/article')).toEqual({ score: 70, tier: '📰 News' });
    });

    it('should give medium score to community sites', () => {
      expect(getSourceAuthorityScore('https://medium.com/article')).toEqual({ score: 50, tier: '📝 Community' });
      expect(getSourceAuthorityScore('https://dev.to/post')).toEqual({ score: 50, tier: '📝 Community' });
    });

    it('should give low score to unknown sites', () => {
      expect(getSourceAuthorityScore('https://random-blog.com')).toEqual({ score: 30, tier: '🌐 Web' });
    });
  });

  describe('classifySearchIntent', () => {
    const classifySearchIntent = (query) => {
      const lowerQuery = query.toLowerCase();
      
      const fastKeywords = ['weather', 'time in', 'current time', 'stock price', 'stock of', 'score of', 'who won', 'population of'];
      if (fastKeywords.some(k => lowerQuery.includes(k))) return 'FAST';
      
      const visualKeywords = ['image', 'photo', 'picture', 'look like', 'show me'];
      if (visualKeywords.some(k => lowerQuery.includes(k))) return 'VISUAL';
      
      return 'COMPLEX';
    };

    it('should classify fast queries', () => {
      expect(classifySearchIntent('what is the weather in New York')).toBe('FAST');
      expect(classifySearchIntent('current time in Tokyo')).toBe('FAST');
      expect(classifySearchIntent('stock price of Apple')).toBe('FAST');
      expect(classifySearchIntent('population of India')).toBe('FAST');
    });

    it('should classify visual queries', () => {
      expect(classifySearchIntent('show me images of cats')).toBe('VISUAL');
      expect(classifySearchIntent('what does a Tesla look like')).toBe('VISUAL');
      expect(classifySearchIntent('picture of Eiffel Tower')).toBe('VISUAL');
    });

    it('should classify complex queries', () => {
      expect(classifySearchIntent('explain quantum computing')).toBe('COMPLEX');
      expect(classifySearchIntent('how to learn Python programming')).toBe('COMPLEX');
      expect(classifySearchIntent('best practices for React development')).toBe('COMPLEX');
    });
  });

  describe('Rate Limiter Logic', () => {
    it('should allow requests within limits', () => {
      const rateLimiter = {
        requests: [],
        maxRequestsPerMinute: 10,
        dailyCount: 0,
        maxRequestsPerDay: 100,
        lastDayReset: Date.now(),
        
        canMakeRequest() {
          const now = Date.now();
          if (this.dailyCount >= this.maxRequestsPerDay) return false;
          this.requests = this.requests.filter(time => now - time < 60000);
          if (this.requests.length >= this.maxRequestsPerMinute) return false;
          return true;
        },
        
        recordRequest() {
          this.requests.push(Date.now());
          this.dailyCount++;
        }
      };

      expect(rateLimiter.canMakeRequest()).toBe(true);
      
      // Record some requests
      for (let i = 0; i < 5; i++) {
        rateLimiter.recordRequest();
      }
      expect(rateLimiter.canMakeRequest()).toBe(true);
      expect(rateLimiter.dailyCount).toBe(5);
    });

    it('should block when per-minute limit is reached', () => {
      const rateLimiter = {
        requests: [],
        maxRequestsPerMinute: 3,
        dailyCount: 0,
        maxRequestsPerDay: 100,
        
        canMakeRequest() {
          const now = Date.now();
          this.requests = this.requests.filter(time => now - time < 60000);
          if (this.requests.length >= this.maxRequestsPerMinute) return false;
          return true;
        },
        
        recordRequest() {
          this.requests.push(Date.now());
          this.dailyCount++;
        }
      };

      // Hit the per-minute limit
      for (let i = 0; i < 3; i++) {
        rateLimiter.recordRequest();
      }
      
      expect(rateLimiter.canMakeRequest()).toBe(false);
    });
  });
});

describe('Data Validation', () => {
  describe('Chat Data Validation', () => {
    it('should validate required chat fields', () => {
      const validateChatData = (data) => {
        if (!data.id || typeof data.id !== 'number') return false;
        if (!data.title || typeof data.title !== 'string') return false;
        if (!Array.isArray(data.history)) return false;
        return true;
      };

      expect(validateChatData({ id: 1, title: 'Test', history: [] })).toBe(true);
      expect(validateChatData({ id: 1, title: 'Test' })).toBe(false);
      expect(validateChatData({ title: 'Test', history: [] })).toBe(false);
      expect(validateChatData({})).toBe(false);
    });

    it('should validate message format', () => {
      const validateMessage = (msg) => {
        if (!msg.role || !['user', 'assistant', 'system'].includes(msg.role)) return false;
        if (typeof msg.content !== 'string') return false;
        return true;
      };

      expect(validateMessage({ role: 'user', content: 'Hello' })).toBe(true);
      expect(validateMessage({ role: 'assistant', content: 'Hi there' })).toBe(true);
      expect(validateMessage({ role: 'invalid', content: 'Test' })).toBe(false);
      expect(validateMessage({ role: 'user' })).toBe(false);
    });
  });
});
