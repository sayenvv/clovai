export interface ExecutionErrorSummary {
  title: string
  summary: string
}

export function primaryExecutionError(messages: string[]): string {
  if (messages.length === 0) return ''
  return messages.reduce((best, message) => (message.length > best.length ? message : best))
}

export function summarizeExecutionError(raw: string): ExecutionErrorSummary {
  const text = raw.trim()
  if (!text) {
    return {
      title: 'The run stopped',
      summary: 'The workflow stopped before it could finish.',
    }
  }

  if (/rate_limit_exceeded|tokens per day|error code:\s*429/i.test(text)) {
    return {
      title: 'Model rate limit',
      summary: `The model reached its token limit, so the run stopped.${retryHint(text)}`,
    }
  }

  if (/error code:\s*401|invalid api key|authentication/i.test(text)) {
    return {
      title: 'Model sign-in failed',
      summary: 'The model rejected the API key. Check the model connection, then run again.',
    }
  }

  if (/timed out|timeout/i.test(text)) {
    return {
      title: 'The model timed out',
      summary: 'The model took too long to respond. Run again.',
    }
  }

  const inner = text.match(/'message':\s*'([^']+)'/)?.[1]
  const sentence = (inner ?? text).split('. ')[0]?.trim()
  const brief = sentence && sentence.length < 180 ? sentence.replace(/\.$/, '') : ''
  return {
    title: 'The run stopped',
    summary: brief
      ? `${brief}.`
      : 'The workflow stopped before it could finish.',
  }
}

function retryHint(raw: string): string {
  const match = raw.match(/try again in\s+(\d+)m(\d+(?:\.\d+)?)s/i)
  if (!match) return ''
  const minutes = Number(match[1])
  const seconds = Number(match[2])
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return ''
  const rounded = seconds >= 30 ? minutes + 1 : minutes
  if (rounded <= 0) return ' Try again in under a minute.'
  if (rounded === 1) return ' Try again in about a minute.'
  return ` Try again in about ${rounded} minutes.`
}
