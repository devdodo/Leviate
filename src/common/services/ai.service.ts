import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly openaiApiKey: string | undefined;
  private readonly anthropicApiKey: string | undefined;
  private readonly openaiModel: string;
  private readonly anthropicModel: string;

  constructor(private configService: ConfigService) {
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.anthropicApiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    this.openaiModel = this.configService.get<string>('OPENAI_MODEL') || 'gpt-4';
    this.anthropicModel =
      this.configService.get<string>('ANTHROPIC_MODEL') || 'claude-3-opus-20240229';
  }

  /**
   * Generate task brief from task inputs
   */
  async generateTaskBrief(taskData: {
    title: string;
    description?: string;
    platforms: string[];
    goals: string[];
    targeting?: any;
    commentsInstructions?: string;
    hashtags?: string[];
    buzzwords?: string[];
  }): Promise<{ brief: string; llmContext: string }> {
    if (!this.openaiApiKey && !this.anthropicApiKey) {
      this.logger.warn('No AI API key configured. Returning template brief.');
      return this.generateTemplateBrief(taskData);
    }

    try {
      const prompt = this.buildBriefPrompt(taskData);

      if (this.openaiApiKey) {
        return await this.generateWithOpenAI(prompt, taskData);
      } else if (this.anthropicApiKey) {
        return await this.generateWithAnthropic(prompt, taskData);
      }
    } catch (error) {
      this.logger.error(`AI brief generation failed: ${error.message}`, error.stack);
      // Fallback to template
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
    if (!this.openaiApiKey && !this.anthropicApiKey) {
      this.logger.warn('No AI API key configured. Skipping verification.');
      return { score: 0, verified: false, reason: 'AI service not configured' };
    }

    try {
      const prompt = this.buildVerificationPrompt(submissionText, llmContext);

      if (this.openaiApiKey) {
        return await this.verifyWithOpenAI(prompt, threshold);
      } else if (this.anthropicApiKey) {
        return await this.verifyWithAnthropic(prompt, threshold);
      }
    } catch (error) {
      this.logger.error(`AI verification failed: ${error.message}`, error.stack);
      return { score: 0, verified: false, reason: 'Verification failed' };
    }

    return { score: 0, verified: false, reason: 'AI service not available' };
  }

  private async generateWithOpenAI(
    prompt: string,
    taskData: any,
  ): Promise<{ brief: string; llmContext: string }> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: this.openaiModel,
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
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const brief = data.choices[0]?.message?.content || '';

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
    const brief = data.content[0]?.text || '';

    const llmContext = this.generateLLMContext(taskData, brief);

    return { brief, llmContext };
  }

  private async verifyWithOpenAI(
    prompt: string,
    threshold: number,
  ): Promise<{ score: number; verified: boolean; reason?: string }> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: this.openaiModel,
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
      throw new Error(`OpenAI API error: ${response.status}`);
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

  private buildBriefPrompt(taskData: any): string {
    return `Generate a comprehensive task brief for the following task:

Title: ${taskData.title}
Description: ${taskData.description || 'N/A'}
Platforms: ${taskData.platforms.join(', ')}
Goals: ${taskData.goals.join(', ')}
Targeting: ${JSON.stringify(taskData.targeting || {})}
Instructions: ${taskData.commentsInstructions || 'N/A'}
Hashtags: ${taskData.hashtags?.join(', ') || 'N/A'}
Buzzwords: ${taskData.buzzwords?.join(', ') || 'N/A'}

Generate a detailed brief that includes:
1. Task overview
2. Platform-specific requirements
3. Content guidelines
4. Expected deliverables
5. Quality standards
6. Any special instructions`;
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
    return `# Task Brief: ${taskData.title}

## Platforms
${taskData.platforms.map((p: string) => `- ${p}`).join('\n')}

## Goals
${taskData.goals.map((g: string) => `- ${g}`).join('\n')}

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

Platforms: ${taskData.platforms.join(', ')}
Goals: ${taskData.goals.join(', ')}

${taskData.description || ''}

Instructions: ${taskData.commentsInstructions || 'Follow platform best practices'}

This is a template brief. Configure AI service for AI-generated briefs.`;

    const llmContext = this.generateLLMContext(taskData, brief);

    return { brief, llmContext };
  }
}

