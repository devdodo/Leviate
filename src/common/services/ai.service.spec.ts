import { AIService } from './ai.service';

describe('AIService brief formatting', () => {
  const service = new AIService({ get: () => undefined } as any);
  /** toPlainText is internal; the brief it produces is the public surface. */
  const plain = (md: string): string => (service as any).toPlainText(md);

  it('strips heading markers', () => {
    expect(plain('# Task Brief: Help Sell Biscuits')).toBe('Task Brief: Help Sell Biscuits');
    expect(plain('## 1. Task Overview')).toBe('1. Task Overview');
    expect(plain('###### Deep')).toBe('Deep');
    expect(plain('## Closing hashes ##')).toBe('Closing hashes');
  });

  it('turns list markers into bullets', () => {
    expect(plain('- Platform: Twitter')).toBe('• Platform: Twitter');
    expect(plain('* Starred')).toBe('• Starred');
    expect(plain('+ Plussed')).toBe('• Plussed');
  });

  it('keeps the indentation of nested list items', () => {
    // Checked mid-document: a leading indent on the first line is trimmed
    // along with the rest of the document's surrounding whitespace.
    expect(plain('- Top\n  - Nested')).toBe('• Top\n  • Nested');
  });

  it('leaves numbered lists alone', () => {
    expect(plain('1. First step')).toBe('1. First step');
  });

  it('removes emphasis without eating ordinary punctuation', () => {
    expect(plain('**Platform:** Twitter (X)')).toBe('Platform: Twitter (X)');
    expect(plain('a _word_ here')).toBe('a word here');
    expect(plain('~~gone~~ kept')).toBe('gone kept');
    expect(plain('use `code` inline')).toBe('use code inline');
    // Identifiers and lone asterisks must survive.
    expect(plain('snake_case_name stays')).toBe('snake_case_name stays');
    expect(plain('2 * 3 = 6')).toBe('2 * 3 = 6');
  });

  it('drops horizontal rules and code fences', () => {
    expect(plain('One\n\n---\n\nTwo')).toBe('One\n\nTwo');
    expect(plain('One\n***\nTwo')).toBe('One\nTwo');
    expect(plain('```js\ncode\n```')).toBe('code');
  });

  it('unwraps links and images', () => {
    expect(plain('[the post](https://x.com/1)')).toBe('the post (https://x.com/1)');
    expect(plain('![a jug](https://cdn/x.png)')).toBe('a jug');
  });

  it('strips blockquote markers', () => {
    expect(plain('> quoted line')).toBe('quoted line');
  });

  it('collapses the blank runs left behind', () => {
    expect(plain('One\n\n\n\nTwo')).toBe('One\n\nTwo');
  });

  it('cleans a real generated brief end to end', () => {
    const brief = [
      '# Task Brief: Help Sell Biscuits',
      '',
      '## 1. Task Overview',
      '',
      'You are asked to create a **video post** for **Twitter** that promotes our **jugs**.',
      '',
      '---',
      '',
      '## 2. Platform-Specific Requirements',
      '',
      '- **Platform:** Twitter (X)',
      '- **Format:** Video post',
      '- **Tone:** Conversational',
    ].join('\n');

    expect(plain(brief)).toBe(
      [
        'Task Brief: Help Sell Biscuits',
        '',
        '1. Task Overview',
        '',
        'You are asked to create a video post for Twitter that promotes our jugs.',
        '',
        '2. Platform-Specific Requirements',
        '',
        '• Platform: Twitter (X)',
        '• Format: Video post',
        '• Tone: Conversational',
      ].join('\n'),
    );
  });

  it('leaves already-plain text untouched', () => {
    const plainBrief = 'Task Overview\n\nCreate a video post for Twitter.';
    expect(plain(plainBrief)).toBe(plainBrief);
  });
});
