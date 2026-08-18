import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly deepseekApiKey: string | undefined;
  private readonly anthropicApiKey: string | undefined;
  private readonly deepseekBaseUrl: string;
  private readonly deepseekModel: string;
  private readonly anthropicModel: string;

  constructor(private configService: ConfigService) {
    this.deepseekApiKey = this.configService.get<string>('DEEPSEEK_API_KEY');
    this.anthropicApiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    this.deepseekBaseUrl =
      this.configService.get<string>('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com/v1';
    this.deepseekModel =
      this.configService.get<string>('DEEPSEEK_MODEL') || 'deepseek-v4-flash';
    this.anthropicModel =
      this.configService.get<string>('ANTHROPIC_MODEL') || 'claude-3-opus-20240229';
  }

  /** DeepSeek speaks the OpenAI chat-completions shape; thinking is disabled for latency. */
  private deepseekChatBody(body: Record<string, any>): string {
    return JSON.stringify({
      model: this.deepseekModel,
      thinking: { type: 'disabled' },
      ...body,
    });
  }

  private deepseekChatUrl(): string {
    return `${this.deepseekBaseUrl.replace(/\/$/, '')}/chat/completions`;
  }

  /**
   * Generate task brief from task inputs
   */
  async generateTaskBrief(taskData: {
    title: string;
    description?: string;
    platforms: string[];
    category?: string;
    contentType?: string;
    goals?: string[]; // Legacy support
    targeting?: any;
    commentsInstructions?: string;
    hashtags?: string[];
    buzzwords?: string[];
  }): Promise<{ brief: string; llmContext: string }> {
    if (!this.deepseekApiKey && !this.anthropicApiKey) {
      this.logger.warn('No AI API key configured. Returning template brief.');
      return this.generateTemplateBrief(taskData);
    }

    try {
      const prompt = this.buildBriefPrompt(taskData);

      if (this.deepseekApiKey) {
        return await this.generateWithDeepSeek(prompt, taskData);
      } else if (this.anthropicApiKey) {
        return await this.generateWithAnthropic(prompt, taskData);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const isAuthOrQuota =
        /API error:\s*(401|403|429)/.test(msg) ||
        /invalid_api_key|incorrect api key/i.test(msg);
      if (isAuthOrQuota) {
        this.logger.warn(
          `AI provider unavailable (${msg.slice(0, 120)}); using template brief.`,
        );
      } else {
        this.logger.error(`AI brief generation failed: ${msg}`, error.stack);
      }
      return this.generateTemplateBrief(taskData);
    }

    return this.generateTemplateBrief(taskData);
  }

  /**
   * Verify task submission against LLM context
   */
  async verifySubmission(
    submissionText: string,
    llmContext: string,
    threshold: number = 80,
  ): Promise<{ score: number; verified: boolean; reason?: string }> {
    if (!this.deepseekApiKey && !this.anthropicApiKey) {
      this.logger.warn('No AI API key configured. Skipping verification.');
      return { score: 0, verified: false, reason: 'AI service not configured' };
    }

    try {
      const prompt = this.buildVerificationPrompt(submissionText, llmContext);

      if (this.deepseekApiKey) {
        return await this.verifyWithDeepSeek(prompt, threshold);
      } else if (this.anthropicApiKey) {
        return await this.verifyWithAnthropic(prompt, threshold);
      }
    } catch (error) {
      this.logger.error(`AI verification failed: ${error.message}`, error.stack);
      return { score: 0, verified: false, reason: 'Verification failed' };
    }

    return { score: 0, verified: false, reason: 'AI service not available' };
  }

  private async generateWithDeepSeek(
    prompt: string,
    taskData: any,
  ): Promise<{ brief: string; llmContext: string }> {
    const response = await fetch(this.deepseekChatUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.deepseekApiKey}`,
      },
      body: this.deepseekChatBody({
        messages: [
          {
            role: 'system',
            content:
              'You are an expert task brief writer. Generate comprehensive, clear task briefs for social media tasks.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    const brief = this.toPlainText(data.choices[0]?.message?.content || '');

    const llmContext = this.generateLLMContext(taskData, brief);

    return { brief, llmContext };
  }

  private async generateWithAnthropic(
    prompt: string,
    taskData: any,
  ): Promise<{ brief: string; llmContext: string }> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.anthropicApiKey!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.anthropicModel,
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const brief = this.toPlainText(data.content[0]?.text || '');

    const llmContext = this.generateLLMContext(taskData, brief);

    return { brief, llmContext };
  }

  private async verifyWithDeepSeek(
    prompt: string,
    threshold: number,
  ): Promise<{ score: number; verified: boolean; reason?: string }> {
    const response = await fetch(this.deepseekChatUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.deepseekApiKey}`,
      },
      body: this.deepseekChatBody({
        messages: [
          {
            role: 'system',
            content:
              'You are a task verification expert. Score how well a submission matches the expected task (0-100). Respond with JSON: {"score": number, "reason": "string"}',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    const resultText = data.choices[0]?.message?.content || '{}';
    const result = JSON.parse(resultText);

    const score = result.score || 0;
    return {
      score,
      verified: score >= threshold,
      reason: result.reason,
    };
  }

  private async verifyWithAnthropic(
    prompt: string,
    threshold: number,
  ): Promise<{ score: number; verified: boolean; reason?: string }> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.anthropicApiKey!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.anthropicModel,
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const resultText = data.content[0]?.text || '{}';
    const result = JSON.parse(resultText);

    const score = result.score || 0;
    return {
      score,
      verified: score >= threshold,
      reason: result.reason,
    };
  }

  /** Task create sends `platforms` as string[] and `category` instead of legacy `goals`. */
  private normalizePlatformList(taskData: any): string[] {
    const p = taskData?.platforms;
    if (p == null) return [];
    const arr = Array.isArray(p) ? p : [p];
    return arr
      .map((x: any) => (typeof x === 'string' ? x : x?.name))
      .filter(Boolean);
  }

  private formatPlatformsLine(taskData: any): string {
    const list = this.normalizePlatformList(taskData);
    return list.length > 0 ? list.join(', ') : 'N/A';
  }

  private formatGoalsLine(taskData: any): string {
    if (Array.isArray(taskData.goals) && taskData.goals.length > 0) {
      return taskData.goals.join(', ');
    }
    if (taskData.category) return String(taskData.category);
    return 'N/A';
  }

  private platformLines(taskData: any): string {
    const list = this.normalizePlatformList(taskData);
    return list.length > 0
      ? list.map((p: string) => `- ${p}`).join('\n')
      : '- N/A';
  }

  private goalLines(taskData: any): string {
    if (Array.isArray(taskData.goals) && taskData.goals.length > 0) {
      return taskData.goals.map((g: string) => `- ${g}`).join('\n');
    }
    if (taskData.category) return `- ${taskData.category}`;
    return '- N/A';
  }

  private buildBriefPrompt(taskData: any): string {
    const platformStr = this.formatPlatformsLine(taskData);
    const goalsStr = this.formatGoalsLine(taskData);
    return `Generate a comprehensive task brief for the following task:

Title: ${taskData.title}
Description: ${taskData.description || 'N/A'}
Platforms: ${platformStr}
Goals: ${goalsStr}
Targeting: ${JSON.stringify(taskData.targeting || {})}
Instructions: ${taskData.commentsInstructions || 'N/A'}
Hashtags: ${taskData.hashtags?.join(', ') || 'N/A'}
Buzzwords: ${taskData.buzzwords?.join(', ') || 'N/A'}

Generate a detailed brief that includes:
1. Task overview
2. Platform-specific requirements
3. Content guidelines
4. Quality standards
5. Any special instructions

Describe only what the task data above states. Do not invent quantities, posting
schedules, timelines, or deliverable counts — how many pieces of content a
contributor owes, and by when, is set by the campaign itself, not by this brief.

Write in PLAIN TEXT. The brief is displayed as-is, so Markdown is not rendered
and its syntax shows up literally. Do not start lines with #, -, *, > or |, and
do not use **bold**, _italics_, backticks, tables, or --- rules. Write section
headings as an ordinary line of text and use short paragraphs.`;
  }

  /**
   * Strip Markdown from a generated brief.
   *
   * The brief is rendered as plain text, so any Markdown the model emits shows
   * up as literal punctuation at the start of every line ("## 1. Task Overview",
   * "- **Platform:** Twitter"). The prompt asks for plain text, but models
   * reliably fall back to Markdown for anything structured, so the output is
   * cleaned rather than trusted.
   *
   * List items keep a "• " marker: they are genuinely lists, and a bullet is a
   * character readers expect rather than syntax leaking through.
   */
  private toPlainText(markdown: string): string {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');

    const cleaned = lines
      // Fence markers and horizontal rules carry no text — drop the whole line.
      .filter((line) => !/^\s*(```|~~~)/.test(line))
      .filter((line) => !/^\s{0,3}([-*_])\s*(\1\s*){2,}$/.test(line))
      .map((line) =>
        line
          // "## Heading" and the rarely-used closing "##"
          .replace(/^\s{0,3}#{1,6}\s+/, '')
          .replace(/\s+#+\s*$/, '')
          // "> quoted"
          .replace(/^\s{0,3}>\s?/, '')
          // "- item" / "* item" / "+ item", preserving indentation
          .replace(/^(\s*)[-*+]\s+/, '$1• '),
      );

    return (
      cleaned
        .join('\n')
        // ![alt](url) before [text](url), so image alt text is not left bracketed.
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/~~([^~]+)~~/g, '$1')
        // Single-marker emphasis only when it wraps a word, so snake_case
        // identifiers and standalone asterisks survive.
        .replace(/(?<![\w*])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![\w*])/g, '$1')
        .replace(/(?<![\w_])_(?!\s)([^_\n]+?)(?<!\s)_(?![\w_])/g, '$1')
        .replace(/`([^`\n]+)`/g, '$1')
        // Removing rules and fences leaves runs of blank lines behind.
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    );
  }

  private buildVerificationPrompt(submissionText: string, llmContext: string): string {
    return `Compare the following task submission with the expected task context and score the match (0-100).

Expected Task Context:
${llmContext}

Actual Submission:
${submissionText}

Score how well the submission matches the expected task. Consider:
- Content relevance
- Platform compliance
- Instruction adherence
- Quality standards

Respond with JSON: {"score": number (0-100), "reason": "brief explanation"}`;
  }

  private generateLLMContext(taskData: any, brief: string): string {
    const platformLines = this.platformLines(taskData);
    const goalLines = this.goalLines(taskData);
    return `# Task Brief: ${taskData.title}

## Platforms
${platformLines}

## Goals
${goalLines}

## Targeting
${taskData.targeting ? JSON.stringify(taskData.targeting, null, 2) : 'N/A'}

## Instructions
${taskData.commentsInstructions || 'N/A'}

## Hashtags
${taskData.hashtags?.join(', ') || 'N/A'}

## Buzzwords
${taskData.buzzwords?.join(', ') || 'N/A'}

## Generated Brief
${brief}

## Expected Output
The tasker should deliver work that matches the brief above, following all platform-specific requirements and quality standards.`;
  }

  private generateTemplateBrief(taskData: any): { brief: string; llmContext: string } {
    const brief = `Task: ${taskData.title}

Platforms: ${this.formatPlatformsLine(taskData)}
Goals: ${this.formatGoalsLine(taskData)}

${taskData.description || ''}

Instructions: ${taskData.commentsInstructions || 'Follow platform best practices'}

This is a template brief. Configure AI service for AI-generated briefs.`;

    const llmContext = this.generateLLMContext(taskData, brief);

    return { brief, llmContext };
  }

  /**
   * Moderate task content before creation.
   * Checks for explicit material and instructions that conflict with the task's stated category.
   * Fails open (approved) when no AI provider is configured so legitimate tasks are never blocked
   * by a missing API key.
   */
  async moderateTaskContent(taskData: {
    category: string;
    title: string;
    description?: string;
    commentsInstructions?: string;
    hashtags?: string[];
    buzzwords?: string[];
  }): Promise<{ approved: boolean; violations: string[]; reason: string }> {
    if (!this.deepseekApiKey && !this.anthropicApiKey) {
      this.logger.warn('No AI API key configured. Skipping content moderation.');
      return { approved: true, violations: [], reason: 'Moderation skipped — AI not configured' };
    }

    const prompt = this.buildModerationPrompt(taskData);

    try {
      if (this.deepseekApiKey) {
        return await this.moderateWithDeepSeek(prompt);
      }
      return await this.moderateWithAnthropic(prompt);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Content moderation failed (${msg.slice(0, 120)}); allowing task through.`);
      return { approved: true, violations: [], reason: 'Moderation unavailable' };
    }
  }

  private buildModerationPrompt(taskData: {
    category: string;
    title: string;
    description?: string;
    commentsInstructions?: string;
    hashtags?: string[];
    buzzwords?: string[];
  }): string {
    const categoryDescriptions: Record<string, string> = {
      LIKE_SHARE_SAVE_REPOST:
        'Contributor only likes, shares, saves, or reposts existing content. No off-platform action is ever needed.',
      COMMENT_POST:
        'Contributor only leaves a comment on an existing post. No off-platform action is ever needed.',
      FOLLOW_ACCOUNT:
        'Contributor only follows a social media account. No off-platform action is ever needed.',
      MAKE_POST:
        'Contributor creates and publishes original content. Content guidelines and hashtags are fine, but asking contributors to send personal photos to the creator, call a phone number, or message on WhatsApp is not allowed.',
    };

    const categoryDesc =
      categoryDescriptions[taskData.category] ??
      'Contributor performs the stated social media action.';

    return `You are a content moderation system for a social media task marketplace. Review the task below for two issues:

1. EXPLICIT CONTENT — adult, sexual, violent, hateful, or otherwise inappropriate material.
2. CONFLICTING INSTRUCTIONS — the task instructions require actions that contradict or go beyond what the task category permits.

Category: ${taskData.category}
Category rule: ${categoryDesc}

--- TASK CONTENT ---
Title: ${taskData.title}
Description: ${taskData.description ?? 'N/A'}
Special instructions: ${taskData.commentsInstructions ?? 'N/A'}
Hashtags: ${taskData.hashtags?.join(', ') || 'N/A'}
Buzzwords: ${taskData.buzzwords?.join(', ') || 'N/A'}
--- END TASK CONTENT ---

EXAMPLES OF CONFLICTING INSTRUCTIONS (violations):
- A LIKE/SHARE task that says "call this number", "text us on WhatsApp", or "send us a photo"
- A FOLLOW task that asks contributors to DM personal details or click an off-platform link to verify
- A COMMENT task that directs contributors to also send a WhatsApp message or submit personal info
- Any task category that collects phone numbers, email addresses, or identification from contributors

Respond ONLY with a valid JSON object — no markdown, no code fences:
{
  "approved": true or false,
  "violations": ["concise description of each violation found, or empty array if none"],
  "reason": "one-sentence summary — 'Content approved' if approved, or the primary reason for rejection"
}`;
  }

  private async moderateWithDeepSeek(
    prompt: string,
  ): Promise<{ approved: boolean; violations: string[]; reason: string }> {
    const response = await fetch(this.deepseekChatUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.deepseekApiKey}`,
      },
      body: this.deepseekChatBody({
        messages: [
          {
            role: 'system',
            content:
              'You are a strict content moderation assistant. Respond only with valid JSON as instructed.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    const raw = data.choices[0]?.message?.content ?? '{}';
    return this.parseModerationResponse(raw);
  }

  private async moderateWithAnthropic(
    prompt: string,
  ): Promise<{ approved: boolean; violations: string[]; reason: string }> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.anthropicApiKey!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.anthropicModel,
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const raw = data.content[0]?.text ?? '{}';
    return this.parseModerationResponse(raw);
  }

  private parseModerationResponse(raw: string): {
    approved: boolean;
    violations: string[];
    reason: string;
  } {
    try {
      // Strip markdown code fences the model may have added despite instructions
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        approved: Boolean(parsed.approved),
        violations: Array.isArray(parsed.violations) ? parsed.violations : [],
        reason: typeof parsed.reason === 'string' ? parsed.reason : '',
      };
    } catch {
      this.logger.warn(`Could not parse moderation response: ${raw.slice(0, 200)}`);
      // Fail open — don't block the creator if our parser breaks
      return { approved: true, violations: [], reason: 'Moderation parse error' };
    }
  }

  /**
   * Generate a compelling task summary/ad copy for prospective contributors
   * This will be displayed to attract contributors to apply for the task
   */
  async generateTaskSummaryForContributors(taskData: {
    title: string;
    description?: string;
    platforms: Array<{ name: string; resourceLink?: string }> | string[];
    category: string;
    contentType?: string;
    budget: number;
    targeting?: {
      targetAudience?: string;
      locations?: string[];
      language?: string;
      gender?: string;
    };
    scheduleStart: Date | string;
    scheduleEnd?: Date | string;
    commentsInstructions?: string;
    hashtags?: string[];
    buzzwords?: string[];
  }): Promise<string> {
    if (!this.deepseekApiKey && !this.anthropicApiKey) {
      this.logger.warn('No AI API key configured. Returning template summary.');
      return this.generateTemplateSummary(taskData);
    }

    try {
      const prompt = this.buildSummaryPrompt(taskData);

      if (this.deepseekApiKey) {
        return await this.generateSummaryWithDeepSeek(prompt);
      } else if (this.anthropicApiKey) {
        return await this.generateSummaryWithAnthropic(prompt);
      }
    } catch (error) {
      this.logger.error(`AI summary generation failed: ${error.message}`, error.stack);
      // Fallback to template
      return this.generateTemplateSummary(taskData);
    }

    return this.generateTemplateSummary(taskData);
  }

  private async generateSummaryWithDeepSeek(prompt: string): Promise<string> {
    const response = await fetch(this.deepseekChatUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.deepseekApiKey}`,
      },
      body: this.deepseekChatBody({
        messages: [
          {
            role: 'system',
            content:
              'You are an expert copywriter specializing in creating compelling, engaging task descriptions for social media influencers and content creators. Your goal is to write attractive, clear summaries that motivate contributors to apply for tasks. Write in a friendly, professional tone that highlights opportunities and benefits.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content?.trim() || '';
  }

  private async generateSummaryWithAnthropic(prompt: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.anthropicApiKey!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.anthropicModel,
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.content[0]?.text?.trim() || '';
  }

  private buildSummaryPrompt(taskData: any): string {
    // Extract platform names if it's an array of objects
    const platformNames =
      taskData.platforms && taskData.platforms.length > 0
        ? taskData.platforms.map((p: any) => (typeof p === 'string' ? p : p.name)).join(', ')
        : 'Multiple platforms';

    // Format dates
    const startDate = taskData.scheduleStart
      ? new Date(taskData.scheduleStart).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'TBD';
    const endDate = taskData.scheduleEnd
      ? new Date(taskData.scheduleEnd).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'Ongoing';

    // Format budget
    const budget = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(taskData.budget);

    // Build targeting info
    const targetingInfo = [];
    if (taskData.targeting?.targetAudience) {
      targetingInfo.push(`Target Audience: ${taskData.targeting.targetAudience}`);
    }
    if (taskData.targeting?.locations && taskData.targeting.locations.length > 0) {
      targetingInfo.push(`Locations: ${taskData.targeting.locations.join(', ')}`);
    }
    if (taskData.targeting?.language) {
      targetingInfo.push(`Language: ${taskData.targeting.language}`);
    }
    if (taskData.targeting?.gender && taskData.targeting.gender !== 'ALL') {
      targetingInfo.push(`Open to: ${taskData.targeting.gender} contributors only`);
    }

    return `Create a compelling, engaging task summary (2-3 sentences) that will attract social media content creators to apply for this task. Make it exciting and highlight the opportunity.

Task Details:
- Title: ${taskData.title}
- Description: ${taskData.description || 'Not provided'}
- Category: ${taskData.category}
- Content Type: ${taskData.contentType || 'Any'}
- Platforms: ${platformNames}
- Budget: ${budget}
${targetingInfo.length > 0 ? `- ${targetingInfo.join('\n- ')}` : ''}
- Campaign Period: ${startDate} to ${endDate}
${taskData.commentsInstructions ? `- Special Instructions: ${taskData.commentsInstructions}` : ''}
${taskData.hashtags && taskData.hashtags.length > 0 ? `- Hashtags: ${taskData.hashtags.join(', ')}` : ''}
${taskData.buzzwords && taskData.buzzwords.length > 0 ? `- Keywords: ${taskData.buzzwords.join(', ')}` : ''}

Requirements:
1. Write in a friendly, professional, and engaging tone
2. Highlight the opportunity and benefits for contributors
3. Mention the budget and platforms clearly
4. If target audience or locations are specified, incorporate them naturally
5. Keep it concise (2-3 sentences, max 200 words)
6. Make it exciting and action-oriented
7. Focus on what contributors will gain from this opportunity

Generate the summary now:`;
  }

  private generateTemplateSummary(taskData: any): string {
    const platformNames =
      taskData.platforms && taskData.platforms.length > 0
        ? taskData.platforms.map((p: any) => (typeof p === 'string' ? p : p.name)).join(', ')
        : 'Multiple platforms';

    const budget = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(taskData.budget);

    let summary = `Join us for an exciting ${taskData.category} opportunity on ${platformNames}! `;
    summary += `Earn ${budget} by creating engaging content. `;

    if (taskData.targeting?.targetAudience) {
      summary += `Perfect for ${taskData.targeting.targetAudience}. `;
    }

    if (taskData.targeting?.locations && taskData.targeting.locations.length > 0) {
      summary += `Open to contributors in ${taskData.targeting.locations.join(', ')}. `;
    }

    summary += `Apply now and be part of this amazing campaign!`;

    return summary;
  }
}

